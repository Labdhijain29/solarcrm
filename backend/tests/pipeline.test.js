const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { getPipeline } = require('../controllers/pipeline.controller');

test('pipeline counts, bounded previews, pages and ownership in a disposable local database', async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/solarcrm_pipeline_test_${process.pid}_${Date.now()}`, { autoIndex: false });
  const managerId = new mongoose.Types.ObjectId();
  const otherId = new mongoose.Types.ObjectId();
  const executiveId = new mongoose.Types.ObjectId();
  const admin = { role: 'Admin', _id: otherId };
  const manager = { role: 'Manager', _id: managerId };
  const call = async (user, query = {}) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await getPipeline({ user, query }, res);
    return res;
  };
  try {
    await User.collection.insertOne({ _id: executiveId, name: 'Registration User', role: 'Registration Executive' });
    const entered = new Date('2026-01-01T00:00:00Z');
    await Lead.collection.insertMany(Array.from({ length: 1107 }, (_, index) => ({
      name: `Customer ${index}`, phone: '4567890123', leadId: index + 1,
      currentStage: 'Registration', status: 'active', createdBy: index < 30 ? managerId : otherId,
      assignedTo: executiveId, city: index % 2 ? 'Ratlam' : 'Indore',
      createdAt: entered, updatedAt: new Date(), history: [
        { stage: 'Registration', action: 'In Progress', timestamp: entered },
        { stage: 'Registration', action: 'Note Added', timestamp: new Date() },
      ],
    })));
    await Lead.collection.insertOne({ name: 'Moved Bank Lead', currentStage: 'Bank Approval', status: 'on-hold', createdBy: otherId, createdAt: entered, history: [{ stage: 'Lead', action: 'Approved', performedBy: managerId, timestamp: entered }] });

    const summary = await call(admin, { status: 'active' });
    assert.equal(summary.code, 200);
    const registration = summary.body.data.find(item => item.stage === 'Registration');
    assert.equal(registration.total, 1107);
    assert.equal(registration.leads.length, 5);
    assert.equal(registration.leads[0].assignedTo.name, 'Registration User');
    assert.equal(new Date(registration.leads[0].stageEnteredAt).getTime(), entered.getTime());
    assert.deepEqual(summary.body.options.cities, ['Indore', 'Ratlam']);

    const first = await call(admin, { stage: 'Registration', page: 1 });
    const second = await call(admin, { stage: 'Registration', page: 2 });
    assert.equal(first.body.data.length, 25);
    assert.equal(first.body.pagination.total, 1107);
    assert.equal(first.body.pagination.pages, 45);
    assert(!second.body.data.some(item => first.body.data.some(previous => String(item._id) === String(previous._id))));
    const last = await call(admin, { stage: 'Registration', page: 999 });
    assert.equal(last.body.pagination.page, 45);
    assert.equal(last.body.data.length, 7);

    const owned = await call(manager, { status: 'All' });
    assert.equal(owned.body.data.find(item => item.stage === 'Registration').total, 30);
    assert.equal(owned.body.data.find(item => item.stage === 'Bank Approval').total, 1);
    const searched = await call(manager, { stage: 'Registration', search: 'Customer 1000' });
    assert.equal(searched.body.pagination.total, 0);
    const filtered = await call(manager, { stage: 'Registration', city: 'Ratlam', assignedTo: String(executiveId) });
    assert.equal(filtered.body.pagination.total, 15);
    assert.equal((await call(admin, { stage: 'Registration', search: '[' })).code, 200);
    assert.equal((await call(admin, { stage: 'Unknown' })).code, 400);
    assert.equal((await call(admin, { assignedTo: 'invalid' })).code, 400);
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
