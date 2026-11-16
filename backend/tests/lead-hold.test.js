const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
const Lead = require('../models/Lead');
const Dispatch = require('../models/Dispatch');
const controller = require('../controllers/lead.controller');
const dispatchController = require('../controllers/dispatch.controller');

test('hold/resume workflow in a disposable local database', async t => {
  const database = `solarcrm_hold_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { autoIndex: false });
  const stages = [['Registration', 'Registration Executive'], ['Bank Approval', 'Bank/Finance Executive'], ['Loan Disbursement', 'Loan Officer'], ['Dispatch', 'Dispatch Manager'], ['Installation', 'Installation Manager']];
  const admin = { _id: new mongoose.Types.ObjectId(), name: 'Admin', role: 'Admin' };
  const call = async (action, user, lead, body = {}, query = {}) => {
    if (action === 'setHoldStatus') body = { stage: lead?.currentStage, ...body };
    const res = { code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
    await controller[action]({ user, params: { id: String(lead?._id || '') }, body, query }, res);
    return res;
  };
  const create = (stage, actor, status = 'active') => Lead.create({ name: 'Hold Test', phone: '4567890123', currentStage: stage, assignedTo: actor._id, status,
    history: [{ stage, action: 'Created', performedBy: actor._id, performedByName: actor.name }] });
  try {
    for (const [stage, role] of stages) await t.test(`${stage}: blank reason, assigned user, history and movement blocks`, async () => {
      const actor = { _id: new mongoose.Types.ObjectId(), name: role, role };
      const lead = await create(stage, actor);
      const held = await call('setHoldStatus', actor, lead, { status: 'on-hold' });
      assert.equal(held.code, 200, held.body.message);
      assert.equal(held.body.data.status, 'on-hold');
      assert.equal(held.body.data.currentStage, stage);
      assert.equal(String(held.body.data.assignedTo), String(actor._id));
      assert.equal(held.body.data.history.at(-1).note, '');
      assert.equal(held.body.data.history.at(-1).action, 'On Hold');
      for (const action of ['approveLead', 'rejectLead', 'transferLead', 'reassignLead']) {
        const result = await call(action, actor, lead, { stage: 'Registration' });
        assert([400, 409].includes(result.code), `${action}: ${result.code} ${result.body.message}`);
      }
      assert.equal((await Lead.findById(lead._id)).history.length, 2);
      const resumed = await call('setHoldStatus', actor, lead, { status: 'active', note: ' Documents received ' });
      assert.equal(resumed.code, 200);
      assert.equal(resumed.body.data.history.at(-1).action, 'Resumed');
      assert.equal(resumed.body.data.history.at(-1).note, 'Documents received');
      assert.equal(resumed.body.data.currentStage, stage);
      assert.equal(String(resumed.body.data.assignedTo), String(actor._id));
    });
    await t.test('permission checks reject other users and wrong roles; Admin is allowed', async () => {
      const actor = { _id: new mongoose.Types.ObjectId(), name: 'Assigned', role: 'Registration Executive' };
      const lead = await create('Registration', actor);
      assert.equal((await call('setHoldStatus', { ...actor, _id: new mongoose.Types.ObjectId() }, lead, { status: 'on-hold' })).code, 403);
      assert.equal((await call('setHoldStatus', { ...actor, role: 'Loan Officer' }, lead, { status: 'on-hold' })).code, 403);
      assert.equal((await call('setHoldStatus', admin, lead, { status: 'on-hold' })).code, 200);
    });
    await t.test('reject invalid states, unsupported stages and oversized reasons without changes', async () => {
      for (const stage of ['Lead', 'Net Metering']) {
        assert.equal((await call('setHoldStatus', admin, await create(stage, admin), { status: 'on-hold' })).code, 400);
      }
      for (const status of ['completed', 'rejected']) {
        const lead = await create('Registration', admin, status);
        assert.equal((await call('setHoldStatus', admin, lead, { status: 'on-hold' })).code, 409);
      }
      const lead = await create('Registration', admin);
      assert.equal((await call('setHoldStatus', admin, lead, { status: 'completed' })).code, 400);
      assert.equal((await call('setHoldStatus', admin, lead, { status: 'active' })).code, 409);
      assert.equal((await call('setHoldStatus', admin, lead, { status: 'on-hold', note: 'x'.repeat(2001) })).code, 400);
      assert.equal((await Lead.findById(lead._id)).history.length, 1);
    });
    await t.test('simultaneous hold requests produce one transition and one history entry', async () => {
      const lead = await create('Registration', admin);
      const results = await Promise.all([call('setHoldStatus', admin, lead, { status: 'on-hold' }), call('setHoldStatus', admin, lead, { status: 'on-hold' })]);
      assert.deepEqual(results.map(result => result.code).sort(), [200, 409]);
      assert.equal((await Lead.findById(lead._id)).history.length, 2);
    });
    await t.test('normal approval/rejection after resume preserves both hold history entries', async () => {
      for (const action of ['approveLead', 'rejectLead']) {
        const lead = await create('Registration', admin);
        await call('setHoldStatus', admin, lead, { status: 'on-hold', note: 'Waiting' });
        await call('setHoldStatus', admin, lead, { status: 'active', note: 'Ready' });
        const result = await call(action, admin, lead, {});
        assert.equal(result.code, 200, result.body.message);
        const saved = await Lead.findById(lead._id);
        assert.equal(saved.history.filter(item => item.action === 'On Hold').length, 1);
        assert.equal(saved.history.filter(item => item.action === 'Resumed').length, 1);
        assert(saved.history.some(item => item.action === (action === 'approveLead' ? 'Approved' : 'Rejected')));
      }
    });
    await t.test('a stale listing cannot hold a lead after it has moved to another stage', async () => {
      const lead = await create('Registration', admin);
      await Lead.updateOne({ _id: lead._id }, { $set: { currentStage: 'Bank Approval' } });
      assert.equal((await call('setHoldStatus', admin, lead, { status: 'on-hold' })).code, 409);
      assert.equal((await Lead.findById(lead._id)).status, 'active');
    });
    await t.test('All includes Active and On Hold only, within the requested stage', async () => {
      for (const status of ['active', 'on-hold', 'completed', 'rejected']) await create('Loan Disbursement', admin, status);
      for (const status of ['active', 'on-hold', 'active,on-hold']) {
        const result = await call('getLeads', admin, null, {}, { stage: 'Loan Disbursement', status, limit: 1000 });
        assert.equal(result.code, 200);
        assert(result.body.data.length);
        assert(result.body.data.every(lead => lead.currentStage === 'Loan Disbursement' && (status === 'active,on-hold' ? ['active', 'on-hold'].includes(lead.status) : lead.status === status)));
      }
    });
    await t.test('dispatch bill approval cannot advance a held lead or lock its invoice', async () => {
      const lead = await create('Dispatch', admin, 'on-hold');
      const id = new mongoose.Types.ObjectId();
      await Dispatch.collection.insertOne({ _id: id, leadId: String(lead._id), mobile: lead.phone, approvalStatus: 'Pending', stockReserved: true });
      const res = { code: 200, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
      await dispatchController.approveDispatch({ user: admin, params: { id: String(id) } }, res);
      assert.equal(res.code, 409, res.body.message);
      assert.equal((await Dispatch.findById(id)).approvalStatus, 'Pending');
      assert.equal((await Lead.findById(lead._id)).currentStage, 'Dispatch');
      assert.equal(await mongoose.connection.db.collection('lead_workflow_locks').countDocuments(), 0);
    });
  } finally {
    if (!mongoose.connection.name.startsWith('solarcrm_hold_test_')) throw new Error('Unexpected test database');
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
