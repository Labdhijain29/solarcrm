const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const User = require('../models/User');
const Lead = require('../models/Lead');
const ServiceRequest = require('../models/ServiceRequest');
const storage = require('../services/storage/storageService');

test('separate service request lifecycle and permissions in a disposable local database', async t => {
  process.env.JWT_SECRET = 'service-request-local-test-only';
  await mongoose.connect(`mongodb://127.0.0.1:27017/solarcrm_service_test_${process.pid}_${Date.now()}`, { autoIndex: false });
  const actors = Object.fromEntries(['admin', 'manager', 'other', 'sales'].map(key => [key, new mongoose.Types.ObjectId()]));
  const roles = { admin: 'Admin', manager: 'Service Manager', other: 'Service Manager', sales: 'Manager' };
  await User.collection.insertMany(Object.entries(actors).map(([key, _id]) => ({ _id, name: key, email: `${key}@test.local`, role: roles[key], isActive: true, approvalStatus: 'approved' })));
  await ServiceRequest.collection.createIndex({ requestNo: 1 }, { unique: true });
  const app = express();
  app.use(express.json());
  app.use('/api/service-requests', require('../routes/serviceRequest.routes'));
  app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/service-requests`;
  const originalUpload = storage.upload;
  const originalDelete = storage.delete;
  const deletedAssets = [];
  let fileSequence = 0;
  let failUploadAt = 0;
  storage.upload = async file => {
    fileSequence += 1;
    if (fileSequence === failUploadAt) throw new Error('Simulated provider failure');
    return { url: `https://files.test/service/${fileSequence}.png`, key: `service-${fileSequence}`, provider: 'cloudinary', resourceType: 'image', uploadedFile: file };
  };
  storage.delete = async key => { deletedAssets.push(key); };
  const call = async (actor, method, path = '', body) => {
    const headers = { Authorization: `Bearer ${jwt.sign({ id: actors[actor] }, process.env.JWT_SECRET)}` };
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const result = await fetch(`${base}${path}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    return { status: result.status, body: await result.json() };
  };
  const customer = { customerName: 'Service Customer', contact: '4567890123', city: 'Ratlam', issue: 'Panel cleaning', address: 'Customer site', visitDate: '2026-11-20' };
  let request;
  try {
    await t.test('Admin assigns, new requests are Pending, and numbers are separate from leads', async () => {
      const created = await call('admin', 'POST', '', { ...customer, assignedTo: actors.manager });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      request = created.body.data;
      assert.equal(request.status, 'pending');
      assert.match(request.requestNo, /^SR-\d{6}$/);
      assert.equal(request.assignedTo._id, String(actors.manager));
      assert.equal(request.history.length, 1);
      assert.equal(request.history[0].performedByName, 'admin');
      assert.equal(await Lead.countDocuments(), 0);
    });
    await t.test('Managers create only for themselves; Admin must select a valid manager', async () => {
      assert.equal((await call('manager', 'POST', '', customer)).status, 201);
      assert.equal((await call('manager', 'POST', '', { ...customer, assignedTo: actors.other })).status, 403);
      assert.equal((await call('admin', 'POST', '', customer)).status, 400);
      assert.equal((await call('admin', 'POST', '', { ...customer, assignedTo: actors.sales })).status, 400);
      assert.equal((await call('manager', 'GET', '/managers')).status, 403);
      assert.equal((await call('admin', 'GET', '/managers')).body.data.length, 2);
      assert.equal((await call('sales', 'GET')).status, 403);
    });
    await t.test('Owned list, search and individual read/write all enforce assignment', async () => {
      assert.equal((await call('manager', 'GET')).body.pagination.total, 2);
      assert.equal((await call('other', 'GET', '?search=Customer')).body.pagination.total, 0);
      assert.equal((await call('other', 'GET', `/${request._id}`)).status, 404);
      assert.equal((await call('other', 'POST', `/${request._id}/activity`, { note: 'Not assigned' })).status, 404);
      assert.equal((await call('other', 'PUT', `/${request._id}/status`, { status: 'completed', currentStatus: 'pending', note: 'Not assigned' })).status, 404);
      assert.equal((await call('manager', 'GET', '?search=[')).status, 200);
    });
    await t.test('Hold, resume, completion note and reopen each preserve activity history', async () => {
      const status = (actor, next, current, note = '') => call(actor, 'PUT', `/${request._id}/status`, { status: next, currentStatus: current, note });
      assert.equal((await status('manager', 'on-hold', 'pending')).status, 200);
      assert.equal((await call('manager', 'GET')).body.pagination.total, 1);
      assert.equal((await call('manager', 'GET', '?status=on-hold')).body.pagination.total, 1);
      assert.equal((await status('manager', 'pending', 'on-hold', 'Ready for visit')).status, 200);
      assert.equal((await status('manager', 'completed', 'pending')).status, 400);
      const complete = await status('manager', 'completed', 'pending', 'Panels cleaned and checked.');
      assert.equal(complete.status, 200);
      assert.ok(complete.body.data.completedAt);
      assert.equal(complete.body.data.history.at(-1).action, 'Completed');
      assert.equal((await status('other', 'pending', 'completed')).status, 404);
      assert.equal((await status('manager', 'pending', 'completed', 'Customer called again')).status, 200);
      assert.equal((await status('manager', 'completed', 'pending', 'Second visit finished')).status, 200);
      const reopened = await status('admin', 'pending', 'completed');
      assert.equal(reopened.status, 200);
      assert.equal(reopened.body.data.history.at(-1).action, 'Reopened');
      assert.equal(reopened.body.data.completedAt, null);
    });
    await t.test('Notes, optional visit changes and real image data are saved with actor/time', async () => {
      const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff9900' } }).png().toBuffer();
      const form = new FormData();
      form.append('note', 'Photo taken after cleaning.');
      form.append('visitDate', '2026-11-25');
      form.append('photos', new Blob([png], { type: 'image/png' }), 'cleaning.png');
      const saved = await call('manager', 'POST', `/${request._id}/activity`, form);
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const entry = saved.body.data.history.at(-1);
      assert.equal(entry.note, 'Photo taken after cleaning.');
      assert.equal(entry.performedByName, 'manager');
      assert.ok(entry.timestamp);
      assert.equal(entry.photos.length, 1);
      assert.equal(entry.previousVisitDate, '2026-11-20');
      assert.equal(saved.body.data.visitDate, '2026-11-25');
      const cleared = await call('manager', 'POST', `/${request._id}/activity`, { visitDate: '' });
      assert.equal(cleared.body.data.visitDate, null);
      assert.equal((await call('manager', 'POST', `/${request._id}/activity`, { visitDate: '2026-02-31' })).status, 400);
      assert.equal((await call('manager', 'POST', `/${request._id}/activity`, {})).status, 400);
    });
    await t.test('Invalid images and partial upload failures leave no broken request entries', async () => {
      const before = await ServiceRequest.findById(request._id);
      const invalid = new FormData();
      invalid.append('photos', new Blob(['not an image'], { type: 'image/png' }), 'invalid.png');
      assert.equal((await call('manager', 'POST', `/${request._id}/activity`, invalid)).status, 400);
      const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer();
      failUploadAt = fileSequence + 2;
      const form = new FormData();
      form.append('photos', new Blob([png], { type: 'image/png' }), 'first.png');
      form.append('photos', new Blob([png], { type: 'image/png' }), 'second.png');
      assert.equal((await call('manager', 'POST', `/${request._id}/activity`, form)).status, 500);
      assert.equal(deletedAssets.length, 1);
      assert.equal((await ServiceRequest.findById(request._id)).history.length, before.history.length);
      failUploadAt = 0;
    });
    await t.test('Limited edits validate fields, enforce ownership and audit old/new values', async () => {
      const current = (await call('manager', 'GET', `/${request._id}`)).body.data;
      const saved = await call('manager', 'PUT', `/${request._id}`, { expectedVersion: current.__v, contact: '4567890999', issue: 'Inverter check', visitDate: '2026-11-29' });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      const entry = saved.body.data.history.at(-1);
      assert.equal(entry.action, 'Details Edited');
      assert.equal(entry.performedByName, 'manager');
      assert.deepEqual(entry.changes.find(change => change.field === 'contact'), { field: 'contact', label: 'Contact number', oldValue: '4567890123', newValue: '4567890999' });
      assert.equal(entry.changes.find(change => change.field === 'visitDate').newValue, '2026-11-29');
      assert.equal(saved.body.data.requestNo, current.requestNo);
      const version = saved.body.data.__v;
      assert.equal((await call('other', 'PUT', `/${request._id}`, { expectedVersion: version, city: 'Other City' })).status, 404);
      for (const field of ['status', 'assignedTo', 'requestNo', 'history', 'createdBy', 'completedAt']) {
        assert.equal((await call('manager', 'PUT', `/${request._id}`, { expectedVersion: version, [field]: 'tampered' })).status, 400);
      }
      assert.equal((await call('manager', 'PUT', `/${request._id}`, { expectedVersion: version, contact: '123' })).status, 400);
      assert.equal((await call('manager', 'PUT', `/${request._id}`, { expectedVersion: version, visitDate: '2026-02-31' })).status, 400);
      assert.equal((await call('manager', 'PUT', `/${request._id}`, { expectedVersion: version, customerName: '' })).status, 400);
      assert.equal((await call('manager', 'PUT', `/${request._id}`, { expectedVersion: version - 1, city: 'Stale' })).status, 409);
      assert.equal((await call('manager', 'PUT', `/${request._id}`, { expectedVersion: version, issue: 'Inverter check' })).status, 400);
      const changed = await call('admin', 'PUT', `/${request._id}`, { expectedVersion: version, city: 'Updated City' });
      assert.equal(changed.status, 200);
      assert.equal(changed.body.data.history.at(-1).performedByName, 'admin');
    });
    await t.test('Concurrent edits preserve one change and reject the stale write', async () => {
      const before = await ServiceRequest.findById(request._id);
      const results = await Promise.all([
        call('manager', 'PUT', `/${request._id}`, { expectedVersion: before.__v, description: 'Manager edit' }),
        call('admin', 'PUT', `/${request._id}`, { expectedVersion: before.__v, description: 'Admin edit' }),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      assert.equal((await ServiceRequest.findById(request._id)).history.length, before.history.length + 1);
    });
    await t.test('Concurrent status changes create one transition and reject stale state', async () => {
      const before = await ServiceRequest.findById(request._id);
      const results = await Promise.all([
        call('manager', 'PUT', `/${request._id}/status`, { currentStatus: 'pending', status: 'on-hold' }),
        call('admin', 'PUT', `/${request._id}/status`, { currentStatus: 'pending', status: 'completed', note: 'Work completed' }),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      assert.equal((await ServiceRequest.findById(request._id)).history.length, before.history.length + 1);
    });
    await t.test('Concurrent creation produces unique request numbers and a bounded list', async () => {
      const results = await Promise.all(Array.from({ length: 27 }, (_, index) => call('manager', 'POST', '', { ...customer, customerName: `Visit ${index}` })));
      assert.ok(results.every(result => result.status === 201));
      assert.equal(new Set(results.map(result => result.body.data.requestNo)).size, 27);
      const first = await call('manager', 'GET');
      const second = await call('manager', 'GET', '?page=2');
      assert.equal(first.body.data.length, 25);
      assert.ok(second.body.data.length > 0);
      assert.ok(first.body.data.every(item => !second.body.data.some(other => other._id === item._id)));
      assert.equal(await Lead.countDocuments(), 0);
    });
    await t.test('Creation accepts photos; oversized batches and invalid fields are rejected', async () => {
      const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer();
      const form = new FormData();
      Object.entries(customer).forEach(([key, value]) => form.append(key, value));
      form.append('photos', new Blob([png], { type: 'image/png' }), 'site.png');
      const created = await call('manager', 'POST', '', form);
      assert.equal(created.status, 201);
      assert.equal(created.body.data.history[0].photos.length, 1);
      assert.equal(created.body.data.assignedTo._id, String(actors.manager));
      const batch = new FormData();
      for (let index = 0; index < 6; index++) batch.append('photos', new Blob([png], { type: 'image/png' }), `site-${index}.png`);
      assert.equal((await call('manager', 'POST', `/${request._id}/activity`, batch)).status, 400);
      assert.equal((await call('manager', 'POST', '', { ...customer, contact: '123' })).status, 400);
      assert.equal((await call('manager', 'POST', '', { ...customer, issue: '' })).status, 400);
      assert.equal((await call('manager', 'GET', '?status=invalid')).status, 400);
    });
  } finally {
    storage.upload = originalUpload;
    storage.delete = originalDelete;
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
