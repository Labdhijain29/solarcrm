const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { storage, runOffice } = require('../services/officeContext');
const Office = require('../models/Office');
const User = require('../models/User');
const Lead = require('../models/Lead');

test('Sales Manager has Admin controls on five dashboards within own office', async t => {
  const dbName = `solarcrm_sales_access_test_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`);
  process.env.JWT_SECRET = 'isolated-sales-access-test';
  let server;
  try {
    const [office, other] = await Office.create([{ name:'Ratlam',code:'RTM' },{ name:'Indore',code:'IND' }]);
    const users = {};
    const roles = ['Admin','Manager','Sales Manager','Name Change Executive','Registration Executive','Bank/Finance Executive','Loan Officer','Dispatch Manager'];
    for (const [i,role] of roles.entries()) users[role] = await runOffice(office._id, () => User.create({ name:role,email:`actor${i}@test.local`,password:'fixture123',role,isActive:true,approvalStatus:'approved' }));
    let number = 1000;
    const makeLead = (stage, targetOffice = office) => runOffice(targetOffice._id, () => Lead.create({ leadId:number++,name:`Customer ${stage}`,phone:'4567890123',currentStage:stage,status:'active',assignedTo:targetOffice === office ? users.Admin._id : null,createdBy:targetOffice === office ? users.Admin._id : null }));
    const stages = ['Lead','Name Change','Registration','Bank Approval','Loan Disbursement'];
    const leads = {};
    for (const stage of [...stages,'Dispatch']) leads[stage] = await makeLead(stage);
    const foreign = await makeLead('Registration',other);
    const app = express();
    app.use(express.json()); app.use((_req,_res,next) => storage.run({},next));
    app.use('/api/leads',require('../routes/lead.routes'));
    app.use('/api/users',require('../routes/user.routes'));
    app.use('/api/offices',require('../routes/office.routes'));
    server = await new Promise(resolve => { const instance = app.listen(0,'127.0.0.1', () => resolve(instance)); });
    const call = async (path,method = 'GET',body,actor = users['Sales Manager'],selected = office) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{ method,headers:{ Authorization:`Bearer ${jwt.sign({ id:actor._id },process.env.JWT_SECRET)}`,'X-Office-Id':String(selected._id),'Content-Type':'application/json' },...(body ? { body:JSON.stringify(body) } : {}) });
      return { status:response.status,body:await response.json() };
    };
    await t.test('all five stage lists and unrelated-assignee details are visible',async () => {
      for (const stage of stages) {
        const result = await call(`leads?stage=${encodeURIComponent(stage)}`);
        assert.equal(result.status,200,JSON.stringify(result.body));
        assert.deepEqual(result.body.data.map(row => row._id),[String(leads[stage]._id)]);
        assert.equal((await call(`leads/${leads[stage]._id}`)).status,200);
      }
    });
    await t.test('edit, note, reject and hold/resume work without personal assignment',async () => {
      for (const stage of stages) {
        const lead = await makeLead(stage);
        const edited = await call(`leads/${lead._id}`,'PUT',{ name:'Updated customer' });
        assert.equal(edited.status,200,JSON.stringify(edited.body));
        assert.equal((await call(`leads/${lead._id}/note`,'POST',{ note:'Manager update' })).status,200);
        if (stage !== 'Lead') {
          for (const status of ['on-hold','active']) {
            const result = await call(`leads/${lead._id}/status`,'POST',{ stage,status });
            assert.equal(result.status,200,JSON.stringify(result.body));
          }
        }
        assert.equal((await call(`leads/${lead._id}/reject`,'POST',{})).status,200);
      }
    });
    await t.test('Lead moves directly to either destination, then through Loan to Dispatch',async () => {
      for (const destination of ['Registration','Name Change']) {
        const lead = await makeLead('Lead');
        const result = await call(`leads/${lead._id}/approve`,'POST',{ targetStage:destination,nextAssigneeId:users[destination === 'Name Change' ? 'Name Change Executive' : 'Registration Executive']._id });
        assert.equal(result.status,200,JSON.stringify(result.body));
        assert.equal(result.body.data.currentStage,destination);
      }
      const progression = [['Name Change','Registration','Registration Executive'],['Registration','Bank Approval','Bank/Finance Executive'],['Bank Approval','Loan Disbursement','Loan Officer'],['Loan Disbursement','Dispatch','Dispatch Manager']];
      for (const [stage,next,role] of progression) {
        const recipients = await call(`users/assignable?stage=${encodeURIComponent(next)}&role=${encodeURIComponent(role)}`);
        assert.equal(recipients.status,200,JSON.stringify(recipients.body));
        assert(recipients.body.data.some(row => row._id === String(users[role]._id)));
        const lead = await makeLead(stage);
        const result = await call(`leads/${lead._id}/approve`,'POST',{ nextAssigneeId:users[role]._id,stageData:stage === 'Loan Disbursement' ? { applicationId:'APP-123' } : {} });
        assert.equal(result.status,200,JSON.stringify(result.body));
        assert.equal(result.body.data.currentStage,next);
      }
    });
    await t.test('completed-stage history counts and reassignment match Admin',async () => {
      const lead = await makeLead('Registration');
      const reassigned = await call(`leads/${lead._id}/reassign`,'POST',{ stage:'Name Change',userId:users['Name Change Executive']._id });
      assert.equal(reassigned.status,200,JSON.stringify(reassigned.body));
      await runOffice(office._id, () => Lead.updateOne({ _id:lead._id },{ $push:{ history:{ stage:'Registration',action:'Approved',performedBy:users.Admin._id,performedByName:'Admin',timestamp:new Date() } } }));
      const query = 'leads?completedStage=Registration';
      const [sales,admin] = await Promise.all([call(query),call(query,'GET',null,users.Admin)]);
      assert.equal(sales.body.pagination.total,admin.body.pagination.total);
    });
    await t.test('later stages, Admin settings and other offices gain no new rights',async () => {
      const id = leads.Dispatch._id;
      assert.equal((await call(`leads/${id}`)).status,403);
      assert.equal((await call(`leads/${id}`,'PUT',{ name:'Forbidden' })).status,403);
      assert.equal((await call(`leads/${id}/approve`,'POST',{})).status,403);
      assert.equal((await call(`leads/${id}/status`,'POST',{ stage:'Dispatch',status:'on-hold' })).status,403);
      assert.equal((await call(`leads/${id}/note`,'POST',{ note:'Forbidden' })).status,403);
      assert.equal((await call('users')).status,403);
      assert.equal((await call('offices')).status,403);
      assert.equal((await call(`leads/${foreign._id}`)).status,404);
      assert.equal((await call('leads?stage=Registration','GET',null,users['Sales Manager'],other)).status,403);
      assert.equal((await call(`leads/${leads.Registration._id}/reject`,'POST',{},users.Manager)).status,403);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name !== dbName || !dbName.startsWith('solarcrm_sales_access_test_')) throw new Error('Unsafe test cleanup');
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
});
