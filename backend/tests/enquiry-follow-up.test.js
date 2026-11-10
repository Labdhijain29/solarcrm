const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const Enquiry = require('../models/Enquiry');
const User = require('../models/User');
const { indiaToday, isValidFollowUpDate } = require('../services/enquiryFollowUp');
const { isEnquiryExecutiveRequestAllowed } = require('../middleware/auth.middleware');

// Real HTTP/auth/routes with isolated in-memory persistence. No database connection is made.
const ids = { admin: '111111111111111111111111', sales: '222222222222222222222222',
  service: '333333333333333333333333', executive: '444444444444444444444444',
  manager: 'aaaaaaaaaaaaaaaaaaaaaaaa', salesManager: 'bbbbbbbbbbbbbbbbbbbbbbbb' };
const enquiryId = '555555555555555555555555';
const users = {
  [ids.admin]: { _id: ids.admin, name: 'Admin', role: 'Admin', isActive: true },
  [ids.sales]: { _id: ids.sales, name: 'Sales', role: 'Sales Executive', isActive: true },
  [ids.service]: { _id: ids.service, name: 'Service', role: 'Service Manager', isActive: true },
  [ids.executive]: { _id: ids.executive, name: 'Executive', role: 'Enquiry Executive', isActive: true },
  [ids.manager]: { _id: ids.manager, name: 'Manager', role: 'Manager', isActive: true },
  [ids.salesManager]: { _id: ids.salesManager, name: 'Sales Manager', role: 'Sales Manager', isActive: true },
};
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const same = (a, b) => a == null && b == null || String(a) === String(b);
const matches = (doc, filter) => Object.entries(filter).every(([key, expected]) => {
  const value = doc[key];
  if (expected instanceof RegExp) return expected.test(String(value || ''));
  if (expected && typeof expected === 'object') {
    if (expected.$not && expected.$not.test(String(value || ''))) return false;
    if ('$ne' in expected && same(value, expected.$ne)) return false;
    if ('$nin' in expected && expected.$nin.some((item) => same(value, item))) return false;
    if ('$lt' in expected && !(value < expected.$lt)) return false;
    if ('$lte' in expected && !(value <= expected.$lte)) return false;
    return true;
  }
  return same(value, expected);
});
const query = (operation) => {
  const result = { select: () => result, sort: () => result, limit: () => result,
    then: (resolve, reject) => Promise.resolve().then(operation).then(resolve, reject) };
  return result;
};
let documents, server, baseUrl, originalSecret;
const originals = [];
const stub = (model, key, fn) => { originals.push([model, key, model[key]]); model[key] = fn; };
const reset = () => { documents = [{ _id: enquiryId, name: 'Customer', contact: '9876543210',
  enquiryType: 'Sales Enquiry', status: 'new', convertedTo: null, pendingConversion: null,
  createdBy: ids.admin, nextFollowUpDate: null, followUps: [], __v: 0 }]; };
const token = (id) => jwt.sign({ id }, process.env.JWT_SECRET);
const request = async (method, path, userId, body) => {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: {
    Authorization: `Bearer ${token(userId)}`, 'Content-Type': 'application/json',
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
};
const plusDays = (days) => new Date(Date.parse(`${indiaToday()}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

before(async () => {
  originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-follow-up-test-secret';
  stub(User, 'findById', (id) => query(() => clone(users[String(id)])));
  stub(Enquiry, 'create', async (data) => ({ _id: 'cccccccccccccccccccccccc', ...clone(data) }));
  stub(Enquiry, 'findOneAndUpdate', (filter, update) => query(() => {
    const item = documents.find((doc) => matches(doc, filter));
    if (!item) return null;
    item.followUps.push(clone(update.$push.followUps));
    Object.assign(item, clone(update.$set));
    item.__v += update.$inc.__v;
    return clone(item);
  }));
  stub(Enquiry, 'find', (filter) => query(() => clone(documents.filter((doc) => matches(doc, filter)))));
  stub(Enquiry, 'countDocuments', async (filter) => documents.filter((doc) => matches(doc, filter)).length);
  reset();
  const app = express();
  app.use(express.json());
  app.use('/api/enquiries', require('../routes/enquiry.routes'));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const [model, key, original] of originals.reverse()) model[key] = original;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

test('all enquiry roles can record shared follow-ups; the last saved date wins', async () => {
  reset();
  const first = await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.sales,
    { note: 'Arranging documents', dueDate: plusDays(7) });
  const second = await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.executive,
    { note: 'Money ready sooner', dueDate: plusDays(2), createdBy: ids.admin });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(documents[0].nextFollowUpDate, plusDays(2));
  assert.deepEqual(documents[0].followUps.map((item) => item.note), ['Arranging documents', 'Money ready sooner']);
  assert.equal(documents[0].followUps[1].createdBy, ids.executive);
  assert.equal(documents[0].followUps[1].createdByName, 'Executive');
});

test('all six Enquiries roles can submit an enquiry and record a follow-up', async () => {
  for (const userId of Object.values(ids)) {
    reset();
    if (userId === ids.service) documents[0].enquiryType = 'Service Enquiry';
    const created = await request('POST', '/api/enquiries', userId,
      { name: 'New customer', contact: '9876543210', enquiryType: documents[0].enquiryType });
    assert.equal(created.status, 201, users[userId].role);
    assert.equal(String(created.body.data.createdBy), userId);
    const followUp = await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, userId,
      { note: 'Call customer', dueDate: indiaToday() });
    assert.equal(followUp.status, 201, users[userId].role);
  }
});

test('a teammate can complete a follow-up and another can schedule a new one', async () => {
  reset();
  await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.admin,
    { note: 'Call again', dueDate: indiaToday() });
  const done = await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.executive,
    { note: 'Customer has finished the paperwork', completed: true });
  assert.equal(done.status, 201);
  assert.equal(documents[0].nextFollowUpDate, null);
  assert.equal(documents[0].followUps.length, 2);
  const resumed = await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.sales,
    { note: 'Customer requests another call', dueDate: plusDays(1) });
  assert.equal(resumed.status, 201);
  assert.equal(documents[0].nextFollowUpDate, plusDays(1));
});

test('follow-up routes respect role visibility and reject converted enquiries', async () => {
  reset();
  documents[0].enquiryType = 'Service Enquiry';
  assert.equal((await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.sales,
    { note: 'Call', dueDate: indiaToday() })).status, 404);
  assert.equal((await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.service,
    { note: 'Call', dueDate: indiaToday() })).status, 201);
  documents[0].convertedTo = '666666666666666666666666';
  assert.equal((await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.admin,
    { note: 'Call', dueDate: indiaToday() })).status, 404);
  assert.equal(documents[0].followUps.length, 1);
  documents[0].convertedTo = null;
  documents[0].pendingConversion = { leadData: {} };
  assert.equal((await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.admin,
    { note: 'Call', dueDate: indiaToday() })).status, 404);
  documents[0].pendingConversion = null;
  documents[0].status = 'closed';
  assert.equal((await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.admin,
    { note: 'Call', dueDate: indiaToday() })).status, 404);
});

test('due summary excludes converted records and scopes Sales and Service views', async () => {
  reset();
  documents[0].nextFollowUpDate = indiaToday();
  documents.push({ ...clone(documents[0]), _id: '777777777777777777777777',
    enquiryType: 'Service Enquiry', nextFollowUpDate: plusDays(-1) });
  documents.push({ ...clone(documents[0]), _id: '888888888888888888888888',
    convertedTo: '666666666666666666666666' });
  documents.push({ ...clone(documents[0]), _id: '999999999999999999999999', status: 'closed' });
  assert.equal((await request('GET', '/api/enquiries/follow-ups/due', ids.admin)).body.data.total, 2);
  assert.equal((await request('GET', '/api/enquiries/follow-ups/due', ids.sales)).body.data.total, 1);
  assert.equal((await request('GET', '/api/enquiries/follow-ups/due', ids.service)).body.data.overdue, 1);
  assert.equal((await request('GET', '/api/enquiries/follow-ups/due', ids.executive)).body.data.dueToday, 1);
});

test('invalid dates and empty notes are rejected without a database change', async () => {
  reset();
  for (const body of [{ note: '', dueDate: indiaToday() }, { note: 'Call', dueDate: '2026-02-30' },
    { note: 'Call', dueDate: plusDays(-1) }]) {
    assert.equal((await request('POST', `/api/enquiries/${enquiryId}/follow-ups`, ids.admin, body)).status, 400);
  }
  assert.equal(documents[0].followUps.length, 0);
  assert.equal(isEnquiryExecutiveRequestAllowed({ method: 'POST', originalUrl: `/api/enquiries/${enquiryId}/follow-ups` }), true);
  assert.equal(isEnquiryExecutiveRequestAllowed({ method: 'GET', originalUrl: '/api/enquiries/follow-ups/due' }), true);
});

test('follow-up dates use the India calendar day and reject impossible dates', () => {
  assert.equal(indiaToday(new Date('2026-11-10T18:29:59Z')), '2026-11-10');
  assert.equal(indiaToday(new Date('2026-11-10T18:30:00Z')), '2026-11-11');
  assert.equal(isValidFollowUpDate('2026-02-30'), false);
  assert.equal(isValidFollowUpDate('2028-02-29'), true);
});
