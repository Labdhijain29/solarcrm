const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const storage = require('../services/storage/storageService');

test('Admin user edits persist profile fields and protect existing account data', async () => {
  process.env.JWT_SECRET = 'local-user-edit-test-only';
  await mongoose.connect(`mongodb://127.0.0.1:27017/solarcrm_user_edit_test_${process.pid}_${Date.now()}`, { autoIndex: false });
  await User.collection.createIndex({ email: 1 }, { unique: true });
  const [admin, user, other] = await User.create([
    { name: 'Admin', email: 'admin@test.local', password: 'old-password', role: 'Admin', phone: '9876543210' },
    { name: 'Customer User', email: 'user@test.local', password: 'old-password', role: 'Sales Executive', phone: '9876543211' },
    { name: 'Other', email: 'other@test.local', password: 'old-password', role: 'Manager', phone: '9876543212' },
  ]);
  const originalPassword = (await User.findById(user._id).select('+password')).password;
  const app = express();
  app.use(express.json());
  app.use('/api/users', require('../routes/user.routes'));
  app.use((error, _req, res, _next) => res.status(400).json({ message: error.message }));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const originalUpload = storage.upload;
  let uploads = 0;
  storage.upload = async file => { uploads++; return { url: 'https://files.test/new.pdf', key: 'new-document', provider: 'cloudinary', resourceType: 'raw', deliveryType: 'upload', uploadedFile: file }; };
  const call = async (actor, body, target = user._id) => {
    const headers = { Authorization: `Bearer ${jwt.sign({ id: actor._id }, process.env.JWT_SECRET)}` };
    if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/users/${target}`, { method: 'PUT', headers, body: body instanceof FormData ? body : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await call(other, { name: 'Not allowed' })).status, 403);
    const before = await User.findById(user._id);
    const edited = await call(admin, { expectedUpdatedAt: before.updatedAt.toISOString(), name: 'Updated User', email: ' UPDATED@Test.Local ', phone: '9898989898', alternateContact: '9797979797', role: 'Name Change Executive', address: 'New address', city: 'Ratlam', state: 'Madhya Pradesh', pincode: '457001', franchiseEnabled: 'true', franchiseName: 'New franchise', franchiseState: 'Madhya Pradesh', franchiseCity: 'Ratlam', franchiseSubDistrict: 'Central', dateOfJoining: '2026-11-17', password: 'do-not-change-password' });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.data.email, 'updated@test.local');
    assert.equal(edited.body.data.role, 'Name Change Executive');
    assert.equal(edited.body.data.franchiseName, 'New franchise');
    assert.equal(edited.body.data.password, undefined);
    assert.equal(edited.body.data.approvalStatus, 'approved');
    assert.equal((await User.findById(user._id).select('+password')).password, originalPassword);
    assert.equal((await call(admin, { expectedUpdatedAt: before.updatedAt.toISOString(), name: 'Stale' })).status, 409);
    assert.equal((await call(admin, { email: 'OTHER@test.local' })).status, 400);
    assert.equal((await call(admin, { phone: '123' })).status, 400);
    assert.equal((await call(admin, { role: 'Invalid' })).status, 400);
    assert.equal((await call(admin, { name: '' })).status, 400);
    assert.equal((await call(admin, { role: 'Manager' }, admin._id)).status, 400);
    const cleared = await call(admin, { franchiseEnabled: false, dateOfJoining: '' });
    assert.equal(cleared.body.data.franchiseName, '');
    assert.equal(cleared.body.data.franchiseEnabled, false);
    assert.equal(cleared.body.data.dateOfJoining, null);
    const invalid = new FormData();
    invalid.append('email', 'bad-email');
    invalid.append('documents', new Blob(['PDF'], { type: 'application/pdf' }), 'registration.pdf');
    assert.equal((await call(admin, invalid)).status, 400);
    assert.equal(uploads, 0);
    const document = new FormData();
    document.append('documents', new Blob(['PDF'], { type: 'application/pdf' }), 'registration.pdf');
    const uploaded = await call(admin, document);
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.body.data.documentsFile.fileKey, 'new-document');
    assert.equal(uploaded.body.data.documentsUploadStatus, 'completed');
    assert.equal(uploaded.body.data.name, 'Updated User');
    assert.equal((await User.findById(user._id).select('+password')).password, originalPassword);
  } finally {
    storage.upload = originalUpload;
    await new Promise(resolve => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
