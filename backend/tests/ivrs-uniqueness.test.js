const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
const Lead = require('../models/Lead');
const Enquiry = require('../models/Enquiry');
const leads = require('../controllers/lead.controller');
const enquiries = require('../controllers/enquiry.controller');
const { withUniqueIvrs, ivrsIndexOptions } = require('../services/ivrsUniqueness');

// Real MongoDB concurrency tests, confined to a disposable localhost database.
test('optional IVRS uniqueness across enquiry and lead save paths', async t => {
  const database = `solarcrm_ivrs_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  const admin = { _id: new mongoose.Types.ObjectId(), name: 'Test Admin', role: 'Admin' };
  const call = async (controller, method, body = {}, id) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await controller[method]({ body, params: { id: String(id || '') }, user: admin, files: {} }, res);
    return res;
  };
  const createLead = value => call(leads, 'createLead', { name: 'Lead customer', phone: '9876543210', ivrsNo: value, source: 'Other' });
  const createEnquiry = value => call(enquiries, 'createEnquiry', { name: 'Enquiry customer', contact: '9876543210', enquiryType: 'Sales Enquiry', ivrsNo: value });
  try {
    await Lead.collection.createIndex({ ivrsNo: 1 }, ivrsIndexOptions);
    await Enquiry.collection.createIndex({ ivrsNo: 1 }, ivrsIndexOptions);
    await t.test('multiple blank numbers are accepted in both collections', async () => {
      for (const create of [createLead, createEnquiry]) {
        for (const blank of [undefined, '', '   ']) assert.equal((await create(blank)).code, 201);
      }
    });
    await t.test('create rejects duplicates across both collections and normalizes case/spaces', async () => {
      const first = await createLead('  abc123  ');
      assert.equal(first.code, 201);
      assert.equal(first.body.data.ivrsNo, 'ABC123');
      assert.equal((await createEnquiry('abc123')).code, 409);
      assert.equal((await createLead('ABC123')).code, 409);
      assert.equal((await createEnquiry('enq123')).code, 201);
      assert.equal((await createLead(' ENQ123 ')).code, 409);
      assert.equal((await createEnquiry('ENQ123')).code, 409);
    });
    await t.test('unchanged values and normal edits pass; conflicting edits fail without data changes', async () => {
      const lead = (await createLead('EDITL')).body.data;
      const enquiry = (await createEnquiry('EDITE')).body.data;
      assert.equal((await call(leads, 'updateLead', { ivrsNo: ' editl ', name: 'Edited lead' }, lead._id)).code, 200);
      assert.equal((await call(enquiries, 'updateEnquiry', { ivrsNo: ' edite ', name: 'Edited enquiry' }, enquiry._id)).code, 200);
      assert.equal((await call(leads, 'updateLead', { ivrsNo: 'EDITE', name: 'Must not save' }, lead._id)).code, 409);
      assert.equal((await call(enquiries, 'updateEnquiry', { ivrsNo: 'EDITL', name: 'Must not save' }, enquiry._id)).code, 409);
      assert.equal((await Lead.findById(lead._id)).name, 'Edited lead');
      assert.equal((await Enquiry.findById(enquiry._id)).name, 'Edited enquiry');
      assert.equal((await call(leads, 'updateLead', { notes: 'No IVRS in payload' }, lead._id)).code, 200);
      assert.equal((await call(enquiries, 'updateEnquiry', { notes: 'No IVRS in payload' }, enquiry._id)).code, 200);
    });
    await t.test('conversion retains the same number and allows linked records to be edited', async () => {
      const enquiry = (await createEnquiry('CONVERT1')).body.data;
      const converted = await call(enquiries, 'convertToLead', {}, enquiry._id);
      assert.equal(converted.code, 200, converted.body.message);
      const lead = converted.body.data;
      assert.equal(lead.ivrsNo, 'CONVERT1');
      assert.equal(String(lead.sourceEnquiry), String(enquiry._id));
      assert.equal((await call(leads, 'updateLead', { ivrsNo: 'convert1' }, lead._id)).code, 200);
      assert.equal((await call(enquiries, 'updateEnquiry', { ivrsNo: 'convert1' }, enquiry._id)).code, 200);
      assert.equal((await createLead('CONVERT1')).code, 409);
      assert.equal((await createEnquiry('CONVERT1')).code, 409);
    });
    await t.test('changing or clearing a number frees the old number when no linked record uses it', async () => {
      const lead = (await createLead('OLD1')).body.data;
      assert.equal((await call(leads, 'updateLead', { ivrsNo: 'NEW1' }, lead._id)).code, 200);
      assert.equal((await createEnquiry('OLD1')).code, 201);
      assert.equal((await call(leads, 'updateLead', { ivrsNo: '' }, lead._id)).code, 200);
      assert.equal((await createEnquiry('NEW1')).code, 201);
    });
    await t.test('older converted records with only convertedTo can retain their own number', async () => {
      const lead = (await createLead('LEGACYLINK')).body.data;
      const enquiry = (await createEnquiry('')).body.data;
      await Enquiry.collection.updateOne({ _id: enquiry._id }, { $set: { convertedTo: lead._id, status: 'converted' } });
      assert.equal((await call(enquiries, 'updateEnquiry', { ivrsNo: 'LEGACYLINK' }, enquiry._id)).code, 200);
      assert.equal((await call(leads, 'updateLead', { ivrsNo: 'legacylink' }, lead._id)).code, 200);
      assert.equal((await createLead('LEGACYLINK')).code, 409);
    });
    await t.test('simultaneous enquiry/lead creates persist exactly one record per number', async () => {
      const results = await Promise.all([createLead('RACE1'), createEnquiry('race1'), createLead(' RACE1 '), createEnquiry('RACE1')]);
      assert.equal(results.filter(r => r.code === 201).length, 1, JSON.stringify(results));
      assert(results.filter(r => r.code !== 201).every(r => r.code === 409));
      assert.equal(await Lead.countDocuments({ ivrsNo: 'RACE1' }) + await Enquiry.countDocuments({ ivrsNo: 'RACE1' }), 1);
    });
    await t.test('simultaneous cross-collection edits persist exactly one claim', async () => {
      const lead = (await createLead('')).body.data;
      const enquiry = (await createEnquiry('')).body.data;
      const results = await Promise.all([
        call(leads, 'updateLead', { ivrsNo: 'RACEEDIT' }, lead._id),
        call(enquiries, 'updateEnquiry', { ivrsNo: 'raceedit' }, enquiry._id),
      ]);
      assert.deepEqual(results.map(r => r.code).sort(), [200, 409]);
    });
    await t.test('failed writes release their lock; legacy mixed case/spaces cannot bypass checks', async () => {
      await assert.rejects(withUniqueIvrs({ value: 'FAIL1' }, async () => { throw new Error('Simulated write failure'); }), /Simulated/);
      assert.equal((await createEnquiry('FAIL1')).code, 201);
      await Lead.collection.insertOne({ name: 'Legacy', ivrsNo: '  legacy1  ' });
      assert.equal((await createEnquiry('LEGACY1')).code, 409);
      assert.equal(await mongoose.connection.db.collection('ivrs_write_locks').countDocuments(), 0);
    });
    await t.test('invalid values fail cleanly and database indexes reject direct duplicates', async () => {
      assert.equal((await createEnquiry('BAD-1')).code, 400);
      assert.equal((await createLead('X'.repeat(16))).code, 400);
      await assert.rejects(Lead.collection.insertOne({ ivrsNo: 'abc123' }), error => error.code === 11000);
      await assert.rejects(Enquiry.collection.insertOne({ ivrsNo: 'enq123' }), error => error.code === 11000);
    });
  } finally {
    // The name is generated above; never use an application database here.
    if (!mongoose.connection.name.startsWith('solarcrm_ivrs_test_')) throw new Error('Unexpected test database');
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
