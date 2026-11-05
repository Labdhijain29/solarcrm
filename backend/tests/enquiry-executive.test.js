const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const Enquiry = require('../models/Enquiry');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Counter = require('../models/Counter');
const { protect, isEnquiryExecutiveRequestAllowed } = require('../middleware/auth.middleware');
const { validateRegister } = require('../middleware/validate.middleware');
const controller = require('../controllers/enquiry.controller');

// Exercise the real HTTP routes/controllers with an isolated in-memory persistence adapter.
// No application database is connected or modified by these tests.
const ownId = '111111111111111111111111';
const otherId = '222222222222222222222222';
const enquiryId = '333333333333333333333333';
const managerId = '444444444444444444444444';
let enquiries, leads, managers, notifications, counter, clock, failFinalize, failLead, beforeClaim;
const saved = [];
const stub = (model, key, fn) => { saved.push([model, key, model[key]]); model[key] = fn; };
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const pathValue = (doc, key) => key.split('.').reduce((value, part) => value?.[part], doc);
const same = (a, b) => a == null && b == null || String(a) === String(b);
const matches = (doc, query) => Object.entries(query).every(([key, value]) => {
  const actual = pathValue(doc, key);
  if (value && typeof value === 'object' && '$ne' in value) return !same(actual, value.$ne);
  return same(actual, value);
});
const query = operation => {
  let sort;
  const result = { select: () => result, populate: () => result, lean: () => result,
    sort: value => { sort = value; return result; },
    then: (resolve, reject) => Promise.resolve().then(() => operation(sort)).then(resolve, reject) };
  return result;
};
const reset = (overrides = {}) => {
  clock = 1; counter = 999; notifications = []; leads = []; failFinalize = false; failLead = false;
  beforeClaim = null;
  enquiries = [{ _id: enquiryId, name: 'Customer', contact: '9876543210', email: 'customer@example.com',
    enquiryType: 'Sales Enquiry', createdBy: ownId, convertedTo: null, status: 'new',
    address: 'Test address', state: 'Rajasthan', city: 'Jaipur', pincode: '302001', __v: 0, updatedAt: clock, ...overrides }];
  managers = [{ _id: managerId, role: 'Manager', name: 'Manager', isActive: true, approvalStatus: 'approved', createdAt: 1 }];
};
const actor = role => ({ _id: ownId, name: 'Executive', role: role || 'Enquiry Executive', isActive: true });
const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const invoke = async (method, body = {}, role) => {
  const res = response();
  await controller[method]({ user: actor(role), body, params: { id: enquiryId }, query: {} }, res);
  return res;
};
let server, baseUrl;
before(async () => {
  stub(Enquiry, 'create', async data => clone(data));
  stub(Enquiry, 'findById', id => query(() => clone(enquiries.find(item => same(item._id, id)))));
  stub(Enquiry, 'find', filter => query(() => clone(enquiries.filter(item => matches(item, filter)))));
  stub(Enquiry, 'findOneAndUpdate', (filter, update) => query(() => {
    if (update.$set?.pendingConversion && beforeClaim) { const hook = beforeClaim; beforeClaim = null; hook(); }
    if (failFinalize && update.$unset?.pendingConversion) throw new Error('Simulated finalize failure');
    const item = enquiries.find(doc => matches(doc, filter));
    if (!item) return null;
    Object.assign(item, clone(update.$set));
    for (const [key, value] of Object.entries(update.$inc || {})) item[key] = (item[key] || 0) + value;
    for (const key of Object.keys(update.$unset || {})) delete item[key];
    item.updatedAt = ++clock;
    return clone(item);
  }));
  stub(Enquiry, 'findOneAndDelete', filter => query(() => {
    const index = enquiries.findIndex(doc => matches(doc, filter));
    return index < 0 ? null : clone(enquiries.splice(index, 1)[0]);
  }));
  stub(Lead.collection, 'createIndex', async () => 'sourceEnquiry_1');
  stub(Lead, 'findOneAndUpdate', (filter, update) => query(() => {
    if (failLead) throw new Error('Simulated lead write failure');
    let item = leads.find(doc => matches(doc, filter));
    if (!item) { item = clone(update.$setOnInsert); leads.push(item); }
    return clone(item);
  }));
  stub(Lead, 'findOne', filter => query(() => clone(leads.find(doc => matches(doc, filter)))));
  stub(Counter, 'findById', async () => ({ seq: counter }));
  stub(Counter, 'findByIdAndUpdate', async () => ({ seq: ++counter }));
  stub(User, 'findOne', filter => query(sort => {
    assert.deepEqual(sort, { createdAt: 1, _id: 1 });
    return clone(managers.filter(item => matches(item, filter)).sort((a, b) => a.createdAt - b.createdAt || a._id.localeCompare(b._id))[0]);
  }));
  stub(User, 'findById', () => query(() => actor()));
  stub(User, 'findByIdAndUpdate', async (id, update) => { notifications.push({ id: String(id), update }); });
  const app = express();
  app.use(express.json());
  app.use('/api/enquiries', require('../routes/enquiry.routes'));
  app.get('/api/leads', protect, (req, res) => res.json({ success: true }));
  app.post('/validate-registration', validateRegister, (req, res) => res.json({ success: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  for (const [model, key, original] of saved.reverse()) model[key] = original;
});

test('new role and nullable ownership are supported without granting a pipeline stage', () => {
  const user = new User({ name: 'Executive', email: 'executive@example.com', password: 'test-password', role: 'Enquiry Executive' });
  assert.equal(user.validateSync(), undefined);
  assert.equal(user.stageAccess, null);
  assert.equal(new Enquiry().createdBy, null);
  assert.equal(Enquiry.schema.path('pendingConversion').options.select, false);
  assert.ok(Lead.schema.indexes().some(([keys, options]) => keys.sourceEnquiry && options.unique && options.sparse));
});

test('API allowlist permits enquiries and self-service, rejects business APIs and other users', () => {
  for (const route of ['GET /api/enquiries', `POST /api/enquiries/${enquiryId}/convert`, `POST /api/enquiries/${enquiryId}/delete`,
    'GET /api/auth/me', 'PUT /api/users/me', 'PUT /api/auth/change-password', 'POST /api/auth/logout']) {
    const [method, originalUrl] = route.split(' ');
    assert.equal(isEnquiryExecutiveRequestAllowed({ method, originalUrl }), true, route);
  }
  for (const path of ['/api/leads', `/api/leads/${enquiryId}`, '/api/dashboard/stats', '/api/dashboard/activity',
    '/api/product', '/api/dispatch', '/api/users', `/api/users/${otherId}`, '/api/users/assignable', '/api/settings/upload']) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) {
      assert.equal(isEnquiryExecutiveRequestAllowed({ method, originalUrl: path }), false, `${method} ${path}`);
    }
  }
});

test('HTTP authentication rejects invalid supplied tokens and verifies ownership instead of trusting body', async () => {
  reset();
  const body = { name: 'Customer', contact: '9876543210', enquiryType: 'Sales Enquiry', createdBy: otherId };
  const request = authorization => fetch(`${baseUrl}/api/enquiries`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) });
  assert.equal((await request('Bearer invalid')).status, 401);
  assert.equal((await request('invalid')).status, 401);
  assert.equal((await (await request()).json()).data.createdBy, null);
  const token = jwt.sign({ id: ownId }, 'isolated-test-secret');
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-test-secret';
  try {
    assert.equal((await (await request(`Bearer ${token}`)).json()).data.createdBy, ownId);
    assert.equal((await fetch(`${baseUrl}/api/leads`, { headers: { Authorization: `Bearer ${token}` } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/enquiries`, { headers: { Authorization: `Bearer ${token}` } })).status, 200);
    reset({ createdBy: otherId });
    assert.equal((await fetch(`${baseUrl}/api/enquiries/${enquiryId}/delete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status, 403);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('registration validator accepts the new role with normal account requirements', async () => {
  const res = await fetch(`${baseUrl}/validate-registration`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Executive', email: 'executive@example.com', password: 'test-password', phone: '9876543210', role: 'Enquiry Executive' }) });
  assert.equal(res.status, 200);
});

test('edit/delete require own unconverted record and cannot spoof conversion or ownership', async () => {
  reset();
  assert.equal((await invoke('updateEnquiry', { name: 'Updated' })).code, 200);
  assert.equal(enquiries[0].name, 'Updated');
  for (const overrides of [{ createdBy: otherId }, { createdBy: null }, { status: 'converted' },
    { convertedTo: managerId }, { pendingConversion: { leadData: {} } }]) {
    reset(overrides);
    assert.equal((await invoke('updateEnquiry', { name: 'Forbidden' })).code, 403);
    assert.equal((await invoke('deleteEnquiry')).code, 403);
    assert.equal(enquiries.length, 1);
  }
  for (const body of [{ status: 'converted' }, { createdBy: otherId }, { convertedTo: managerId }, { pendingConversion: {} }]) {
    reset(); assert.equal((await invoke('updateEnquiry', body)).code, 403);
  }
  reset(); assert.equal((await invoke('deleteEnquiry')).code, 200); assert.equal(enquiries.length, 0);
  reset({ createdBy: otherId, status: 'converted' });
  assert.equal((await invoke('updateEnquiry', { notes: 'Admin edit' }, 'Admin')).code, 200);
  assert.equal((await invoke('deleteEnquiry', {}, 'Manager')).code, 200);
});

test('conversion of another creator enquiry hands off to earliest approved active Manager and copies customer data', async () => {
  reset({ createdBy: otherId });
  managers.push({ ...managers[0], _id: '555555555555555555555555' },
    { ...managers[0], _id: otherId, isActive: false, createdAt: 0 },
    { ...managers[0], _id: ownId, approvalStatus: 'pending', createdAt: 0 });
  const res = await invoke('convertToLead');
  assert.equal(res.code, 200);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].assignedTo, managerId);
  assert.equal(leads[0].createdBy, ownId);
  assert.equal(leads[0].history[0].performedBy, ownId);
  assert.equal(leads[0].leadId, 1000);
  assert.equal(leads[0].currentStage, 'Lead');
  assert.equal(leads[0].status, 'active');
  for (const key of ['address', 'state', 'city', 'pincode']) assert.equal(leads[0][key], enquiries[0][key]);
  assert.equal(enquiries[0].status, 'converted');
  assert.equal(enquiries[0].convertedTo, leads[0]._id);
  assert.equal(notifications[0].id, managerId);
  assert.equal(res.body.data.name, undefined);
  assert.equal((await invoke('convertToLead')).code, 400);
});

test('missing Manager and Service Enquiries do not modify the enquiry', async () => {
  reset(); managers = [];
  assert.equal((await invoke('convertToLead')).code, 409);
  assert.equal(enquiries[0].pendingConversion, undefined);
  assert.equal(leads.length, 0);
  reset({ enquiryType: ' service enquiry ' });
  assert.equal((await invoke('convertToLead')).code, 400);
  assert.equal(leads.length, 0);
});

test('parallel conversion and retry after finalize failure produce exactly one lead', async () => {
  reset();
  const results = await Promise.all([invoke('convertToLead'), invoke('convertToLead')]);
  assert.ok(results.every(res => [200, 400, 409].includes(res.code)));
  assert.ok(results.some(res => res.code === 200));
  assert.equal(leads.length, 1); assert.equal(notifications.length, 1);
  reset(); failFinalize = true;
  assert.equal((await invoke('convertToLead')).code, 500);
  assert.equal(leads.length, 1);
  assert.equal((await invoke('deleteEnquiry')).code, 403);
  failFinalize = false;
  assert.equal((await invoke('convertToLead')).code, 200);
  assert.equal(leads.length, 1); assert.equal(enquiries[0].status, 'converted');
});

test('failed lead write reserves a consistent snapshot and blocks edits until retry succeeds', async () => {
  reset(); failLead = true;
  assert.equal((await invoke('convertToLead')).code, 500);
  assert.equal((await invoke('updateEnquiry', { name: 'Racing edit' })).code, 403);
  assert.equal((await invoke('deleteEnquiry', {}, 'Admin')).code, 403);
  failLead = false;
  assert.equal((await invoke('convertToLead')).code, 200);
  assert.equal(leads.length, 1); assert.equal(leads[0].name, 'Customer');
});

test('an edit or deletion before the conversion reservation prevents a stale lead snapshot', async () => {
  reset();
  beforeClaim = () => { enquiries[0].name = 'Edited in the same millisecond'; enquiries[0].__v += 1; };
  assert.equal((await invoke('convertToLead')).code, 409);
  assert.equal(leads.length, 0);
  assert.equal((await invoke('convertToLead')).code, 200);
  assert.equal(leads[0].name, 'Edited in the same millisecond');
  reset(); beforeClaim = () => { enquiries = []; };
  assert.equal((await invoke('convertToLead')).code, 409);
  assert.equal(leads.length, 0);
});

test('existing roles retain enquiry visibility filters and conversion assignment', async () => {
  reset();
  assert.deepEqual(controller.buildEnquiryQueryForRole(actor()), {});
  assert.deepEqual(controller.buildEnquiryQueryForRole(actor('Admin')), {});
  assert.ok(controller.buildEnquiryQueryForRole(actor('Sales Manager')).enquiryType.$not);
  assert.ok(controller.buildEnquiryQueryForRole(actor('Service Manager')).enquiryType instanceof RegExp);
  for (const role of ['Admin', 'Manager', 'Sales Executive', 'Sales Manager']) {
    reset(); assert.equal((await invoke('convertToLead', {}, role)).code, 200);
    assert.equal(leads[0].assignedTo, ownId);
  }
});
