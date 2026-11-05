const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const storageService = require('../services/storage/storageService');
const { uploadUserDocument } = require('../services/userAccount');

// Real routes, validation and account/upload services; persistence/storage are isolated adapters.
const adminId = '111111111111111111111111';
let records = [], updates = [], uploads = [], role = 'Admin', failUpload = false, duplicateRace = false;
const saved = [];
const stub = (object, key, fn) => { saved.push([object, key, object[key]]); object[key] = fn; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const form = () => ({ name: 'Test user', email: 'newuser@example.com', password: 'sample-password',
  phone: '+91 9876543210', alternateContact: '9123456789', role: 'Enquiry Executive',
  permanentAddress: 'Permanent address', address: 'Current address', state: 'Rajasthan', city: 'Jaipur', pincode: '302001',
  dateOfJoining: '2026-11-05', franchiseEnabled: true, franchiseName: 'Test franchise',
  franchiseState: 'Rajasthan', franchiseCity: 'Jaipur', franchiseSubDistrict: 'Jaipur North' });
let server, baseUrl, token, previousSecret;
before(async () => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-account-test-secret';
  token = jwt.sign({ id: adminId }, process.env.JWT_SECRET);
  stub(User, 'findOne', async filter => records.find(record => record.email === filter.email) || null);
  stub(User, 'create', async data => {
    if (duplicateRace) throw Object.assign(new Error('Duplicate email'), { code: 11000 });
    const record = new User(data);
    await record.validate();
    records.push(record);
    return record;
  });
  stub(User, 'findById', id => ({ select: async selection => {
    if (String(id) === adminId) return { _id: adminId, isActive: true, role };
    const record = records.find(item => String(item._id) === String(id));
    if (!record) return null;
    const safe = record.toObject();
    if (selection === '-password') delete safe.password;
    return { ...safe, toObject: () => safe };
  } }));
  stub(User, 'findByIdAndUpdate', async (id, data) => {
    updates.push({ id: String(id), data });
    const record = records.find(item => String(item._id) === String(id));
    if (record) Object.assign(record, data);
    return record;
  });
  stub(User, 'updateMany', async () => {});
  stub(storageService, 'upload', async (file, options) => {
    if (failUpload) throw new Error('Simulated storage failure');
    uploads.push({ file, options });
    return { key: 'test/document.pdf', url: 'https://example.invalid/document.pdf', provider: 'test' };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth.routes'));
  app.use('/api/users', require('../routes/user.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 400).json({ message: error.message }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await settle();
  await new Promise(resolve => server.close(resolve));
  for (const [object, key, original] of saved.reverse()) object[key] = original;
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});
const reset = () => { records = []; uploads = []; updates = []; role = 'Admin'; failUpload = false; duplicateRace = false; };
const request = (path, data = form(), authenticated = path === '/api/users') => fetch(baseUrl + path, {
  method: 'POST', headers: { ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
  body: data instanceof FormData ? data : JSON.stringify(data),
});

test('Admin creation saves the full profile and franchise fields, approves and records the Admin', async () => {
  reset();
  const data = { ...form(), email: ' NEWUSER@EXAMPLE.COM ', isActive: false, approvalStatus: 'pending', approvedBy: 'spoofed' };
  const res = await request('/api/users', data);
  assert.equal(res.status, 201);
  const result = (await res.json()).data;
  for (const key of ['name', 'alternateContact', 'permanentAddress', 'address', 'state', 'city', 'pincode',
    'franchiseEnabled', 'franchiseName', 'franchiseState', 'franchiseCity', 'franchiseSubDistrict']) assert.equal(result[key], data[key], key);
  assert.equal(result.phone, '9876543210');
  assert.equal(result.email, 'newuser@example.com');
  assert.equal(result.dateOfJoining.slice(0, 10), data.dateOfJoining);
  assert.equal(result.isActive, true); assert.equal(result.approvalStatus, 'approved');
  assert.equal(result.approvedBy, adminId); assert.ok(result.approvedAt);
  assert.equal(result.password, undefined);
});

test('public registration shares the fields but cannot self-approve or register an Admin', async () => {
  reset();
  const res = await request('/api/auth/register', { ...form(), isActive: true, approvalStatus: 'approved', approvedBy: adminId });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.isActive, false); assert.equal(body.data.approvalStatus, 'pending');
  assert.equal(body.data.approvedBy, null); assert.equal(body.data.approvedAt, null);
  assert.equal(body.data.franchiseSubDistrict, form().franchiseSubDistrict);
  assert.equal(body.data.password, undefined);
  assert.ok(body.documentUploadToken);
  assert.equal((await request('/api/auth/register', { ...form(), role: 'Admin' })).status, 422);
});

test('public and Admin creation use the same validation, role list and duplicate handling', async () => {
  for (const path of ['/api/users', '/api/auth/register']) {
    for (const invalid of [{ alternateContact: '123' }, { phone: '123' }, { password: '123' }, { email: 'bad-email' },
      { role: 'Unknown' }, { pincode: '123' }, { dateOfJoining: 'invalid' }, { franchiseEnabled: 'invalid' }]) {
      reset(); assert.equal((await request(path, { ...form(), ...invalid })).status, 422, `${path} ${JSON.stringify(invalid)}`);
      assert.equal(records.length, 0);
    }
    reset(); assert.equal((await request(path)).status, 201);
    assert.equal((await request(path)).status, 400);
    reset(); duplicateRace = true;
    assert.equal((await request(path)).status, 409);
  }
  reset(); assert.equal((await request('/api/users', { ...form(), role: 'Admin' })).status, 201);
});

test('user creation remains Admin-only; false franchise does not retain hidden details', async () => {
  for (const actorRole of ['Manager', 'Sales Executive', 'Enquiry Executive']) {
    reset(); role = actorRole;
    assert.equal((await request('/api/users')).status, 403);
    assert.equal(records.length, 0);
  }
  reset(); assert.equal((await request('/api/users', form(), false)).status, 401);
  const res = await request('/api/users', { ...form(), franchiseEnabled: 'false' });
  const data = (await res.json()).data;
  assert.equal(data.franchiseEnabled, false);
  for (const key of ['franchiseName', 'franchiseState', 'franchiseCity', 'franchiseSubDistrict']) assert.equal(data[key], '');
});

test('Admin multipart document uses the shared upload helper and records completion', async () => {
  reset();
  const data = new FormData();
  for (const [key, value] of Object.entries(form())) data.append(key, String(value));
  data.append('documents', new Blob(['test PDF'], { type: 'application/pdf' }), 'document.pdf');
  const res = await request('/api/users', data);
  assert.equal(res.status, 201);
  await settle(); await settle();
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].options.folder, 'users/registrations');
  assert.equal(records[0].documentsUploadStatus, 'completed');
  assert.equal(records[0].documentsFile.originalName, 'document.pdf');
  assert.equal(records[0].approvalStatus, 'approved');
});

test('registration document token still restricts upload to its pending account', async () => {
  reset();
  const registered = await (await request('/api/auth/register')).json();
  const fileData = uploadToken => {
    const data = new FormData(); data.append('uploadToken', uploadToken);
    data.append('documents', new Blob(['test PDF'], { type: 'application/pdf' }), 'document.pdf');
    return data;
  };
  const path = `/api/auth/register/${registered.data._id}/document`;
  assert.equal((await request(path, fileData('invalid'), false)).status, 403);
  assert.equal((await request(path, fileData(registered.documentUploadToken), false)).status, 200);
  assert.equal(records[0].documentsUploadStatus, 'completed');
  records[0].approvalStatus = 'approved';
  assert.equal((await request(path, fileData(registered.documentUploadToken), false)).status, 400);
});

test('shared upload helper preserves the account and marks document failures', async () => {
  reset(); await request('/api/users'); failUpload = true;
  await assert.rejects(uploadUserDocument(records[0]._id, { originalname: 'document.pdf' }), /Simulated storage failure/);
  assert.equal(records[0].documentsUploadStatus, 'failed');
  assert.equal(records[0].isActive, true);
  assert.equal(records[0].approvalStatus, 'approved');
});
