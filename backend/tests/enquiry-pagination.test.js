const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const Enquiry = require('../models/Enquiry');
const User = require('../models/User');
const Office = require('../models/Office');
const { storage,runOffice } = require('../services/officeContext');
const { indiaToday } = require('../services/enquiryFollowUp');

test('enquiries: 50-row server pages preserve office/role boundaries, filters and totals',async t => {
  const dbName = `solarcrm_enquiry_paging_test_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`);
  process.env.JWT_SECRET = 'isolated-enquiry-pagination-test';
  let server;
  try {
    const [a,b] = await Office.create([{ name:'Ratlam',code:'RTM' },{ name:'Indore',code:'IND' }]);
    const actors = {};
    for (const role of ['Admin','Manager','Sales Executive','Service Manager','Enquiry Executive']) actors[role] = await runOffice(a._id, () => User.create({ name:role,email:`${role.replaceAll(' ','')}@test.local`,password:'fixture123',role,isActive:true }));
    const today = indiaToday();
    const offset = days => new Date(new Date(`${today}T12:00:00Z`).getTime() + days*86400000).toISOString().slice(0,10);
    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const make = (name,office,values = {}) => ({ _id:new mongoose.Types.ObjectId(),office,name,contact:'9000000000',enquiryType:'Sales Enquiry',status:'new',convertedTo:null,createdBy:actors.Admin._id,createdAt:new Date(base),updatedAt:new Date(base),followUps:[],...values });
    const rows = Array.from({ length:120 },(_,index) => make(`Person ${String(index + 1).padStart(3,'0')}`,a._id,{ contact:String(9000000001 + index),createdAt:new Date(base + (index+1)*60000),nextFollowUpDate:index < 40 ? today : index < 80 ? offset(-1) : offset(1) }));
    rows.at(-1).pendingConversion = { reserved:true };
    const extras = [make('Legacy converted',a._id,{ convertedTo:new mongoose.Types.ObjectId(),nextFollowUpDate:today }),make('Status converted',a._id,{ status:'converted',nextFollowUpDate:today }),make('Closed',a._id,{ status:'closed',nextFollowUpDate:offset(-1) }),make('No date',a._id),make('Blank date',a._id,{ nextFollowUpDate:'' }),make('Service One',a._id,{ enquiryType:'Service Enquiry',nextFollowUpDate:today }),make('Service Two',a._id,{ enquiryType:'Service Enquiry',nextFollowUpDate:today })];
    const foreign = Array.from({ length:60 },(_,index) => make(`Other office ${index}`,b._id,{ nextFollowUpDate:today }));
    await Enquiry.collection.insertMany([...rows,...extras,...foreign]);
    const app = express();app.use(express.json());app.use((_req,_res,next) => storage.run({},next));app.use('/api/enquiries',require('../routes/enquiry.routes'));
    server = await new Promise(resolve => { const running = app.listen(0,'127.0.0.1', () => resolve(running)); });
    const call = async (params = {},role = 'Admin',method = 'GET',suffix = '',body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/enquiries${suffix}?${new URLSearchParams(params)}`,{ method,headers:{ Authorization:`Bearer ${jwt.sign({ id:actors[role]._id },process.env.JWT_SECRET)}`,'X-Office-Id':String(a._id),'Content-Type':'application/json' },...(body ? { body:JSON.stringify(body) } : {}) });
      return { status:response.status,body:await response.json() };
    };
    await t.test('three non-overlapping pages, fixed limit, hidden internal reservation and complete totals',async () => {
      const pages = [];
      for (const page of [1,2,3]) {
        const result = await call({ page,conversion:'not-converted',limit:1000 });assert.equal(result.status,200,JSON.stringify(result.body));pages.push(result.body);
        assert.equal(result.body.pagination.limit,50);assert.equal(result.body.pagination.total,125);assert.equal(result.body.pagination.pages,3);
        assert.deepEqual(result.body.overview,{ total:127,today:42,overdue:40,upcoming:40 });
        assert(result.body.data.every(item => item.office === String(a._id) && !('pendingConversion' in item)));
      }
      assert.deepEqual(pages.map(page => page.data.length),[50,50,25]);
      assert.equal(new Set(pages.flatMap(page => page.data.map(item => item._id))).size,125);
      assert.equal(pages[0].data[0].name,'Person 120');assert.equal(pages[1].data[0].name,'Person 070');
      const repeated = await call({ page:1,conversion:'not-converted' });assert.deepEqual(repeated.body.data.map(item => item._id),pages[0].data.map(item => item._id));
    });
    await t.test('searches the whole dataset and escapes regex input; count follows filters',async () => {
      const searched = await call({ search:'person 003',conversion:'not-converted' });assert.equal(searched.body.pagination.total,1);assert.equal(searched.body.data[0].name,'Person 003');
      assert.equal((await call({ search:rows[2].contact })).body.pagination.total,1);
      for (const search of ['Other office','[','.*']) assert.equal((await call({ search })).body.pagination.total,0);
      assert.equal((await call({ search:'z'.repeat(201) })).status,400);
    });
    await t.test('all follow-up/conversion filters and legacy converted rows match existing semantics',async () => {
      for (const [followUp,count] of Object.entries({ today:42,overdue:40,due:82,upcoming:40,none:2 })) {
        const result = await call({ followUp,conversion:'not-converted' });assert.equal(result.status,200);assert.equal(result.body.pagination.total,count);
      }
      assert.equal((await call({ conversion:'converted' })).body.pagination.total,2);
      assert.equal((await call({ conversion:'converted',followUp:'none' })).body.pagination.total,0);
      assert.equal((await call({ status:'closed' })).body.pagination.total,1);
    });
    await t.test('sort applies across pages with stable ties, dates without follow-ups sort last',async () => {
      const ascending = await call({ sort:'name-asc' });const second = await call({ sort:'name-asc',page:2 });
      assert.equal(ascending.body.data[0].name,'Blank date');assert(ascending.body.data.at(-1).name.localeCompare(second.body.data[0].name) <= 0);
      assert.equal((await call({ sort:'oldest',search:'Person' })).body.data[0].name,'Person 001');
      assert.equal((await call({ sort:'number-desc',search:'Person' })).body.data[0].name,'Person 120');
      const due = await call({ sort:'due',page:3 });assert.deepEqual(due.body.data.slice(-2).map(item => item.name).sort(),['Blank date','No date']);
    });
    await t.test('every page and overview keeps the role and office restriction',async () => {
      for (const role of ['Manager','Enquiry Executive']) assert.equal((await call({},role)).body.pagination.total,127);
      const sales = await call({},'Sales Executive');assert.equal(sales.body.pagination.total,125);assert.equal(sales.body.overview.today,40);assert(sales.body.data.every(item => item.enquiryType !== 'Service Enquiry'));
      const service = await call({},'Service Manager');assert.equal(service.body.pagination.total,2);assert.equal(service.body.overview.today,2);assert(service.body.data.every(item => item.enquiryType === 'Service Enquiry'));
    });
    await t.test('invalid queries are rejected; oversized pages clamp safely',async () => {
      for (const page of ['0','-1','1.5','bad']) assert.equal((await call({ page })).status,400);
      for (const params of [{sort:'bad'},{followUp:'bad'},{conversion:'bad'},{'search[$ne]':'x'}]) assert.equal((await call(params)).status,400);
      const result = await call({ page:999,search:'missing' });assert.deepEqual(result.body.pagination,{ page:1,limit:50,total:0,pages:1 });
      assert.equal((await call({ page:999 })).body.pagination.page,3);
    });
    await t.test('saving follow-up updates global counts and filtered membership',async () => {
      const updated = await call({},'Admin','POST',`/${rows[118]._id}/follow-ups`,{ note:'Call today',dueDate:today });assert.equal(updated.status,201,JSON.stringify(updated.body));
      const list = await call({ followUp:'upcoming' });assert.equal(list.body.pagination.total,39);assert.equal(list.body.overview.today,43);assert.equal(list.body.overview.upcoming,39);
    });
    await t.test('deleting the only row on the last page returns the previous valid page',async () => {
      const removable = Array.from({length:51},(_,index) => make(`Removable ${index}`,a._id));await Enquiry.collection.insertMany(removable);
      const last = await call({ search:'Removable',page:2 });assert.equal(last.body.data.length,1);
      assert.equal((await call({},'Admin','DELETE',`/${last.body.data[0]._id}`)).status,200);
      const refreshed = await call({ search:'Removable',page:2 });assert.deepEqual(refreshed.body.pagination,{ page:1,pages:1,total:50,limit:50 });assert.equal(refreshed.body.data.length,50);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === dbName && dbName.startsWith('solarcrm_enquiry_paging_test_')) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
