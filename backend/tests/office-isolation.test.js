const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { storage, runOffice, runGlobal } = require('../services/officeContext');
const Office = require('../models/Office');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Enquiry = require('../models/Enquiry');
const Product = require('../models/Product');
const ServiceRequest = require('../models/ServiceRequest');
require('../models/Dispatch'); require('../models/InventoryActivity');

test('two offices: real authenticated routes and model boundaries isolate business records', async t => {
  const dbName = `solarcrm_office_test_${Date.now()}`;
  await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`);
  process.env.JWT_SECRET = 'isolated-office-test-secret';
  let server;
  try {
    const [a,b] = await Office.create([{ name:'Ratlam Office', code:'RTM' }, { name:'Indore Office', code:'IND' }]);
    const createUser = (office, name, role) => runOffice(office._id, () => User.create({ name, email:`${name}@test.local`, password:'test12345', role, phone:'9876543210', isActive:true, approvalStatus:'approved' }));
    const admin = await createUser(a,'admin','Admin');
    const managerA = await createUser(a,'managera','Manager');
    const managerB = await createUser(b,'managerb','Manager');
    const serviceA = await createUser(a,'servicea','Service Manager');
    const serviceB = await createUser(b,'serviceb','Service Manager');
    const leads = [];
    for (const [office,manager] of [[a,managerA],[b,managerB]]) leads.push(await runOffice(office._id, () => Lead.create({ leadId:office.code === 'RTM' ? 1000 : 1001, name:office.name, phone:'4567890123', assignedTo:manager._id, createdBy:admin._id, ivrsNo:office.code, currentStage:'Lead' })));
    const app = express();
    app.use(express.json()); app.use((_req,_res,next) => storage.run({},next));
    const { signLocalFiles, protectLocalFile } = require('../middleware/officeFiles.middleware');
    app.use(signLocalFiles); app.get('/uploads/test.pdf',protectLocalFile,(_req,res) => res.json({ ok:true }));
    for (const [route,file] of [['auth','auth'],['users','user'],['leads','lead'],['enquiries','enquiry'],['service-requests','serviceRequest'],['dashboard','dashboard'],['product','product'],['dispatch','dispatch'],['offices','office']]) app.use(`/api/${route}`, require(`../routes/${file}.routes`));
    app.use((error,req,res,next) => res.status(error.statusCode || 500).json({ message:error.message }));
    server = await new Promise(resolve => { const running = app.listen(0,'127.0.0.1', () => resolve(running)); });
    const call = async (route, actor, office, method = 'GET', body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`, { method, headers:{ ...(actor ? { Authorization:`Bearer ${jwt.sign({ id:actor._id },process.env.JWT_SECRET)}` } : {}), ...(office ? { 'X-Office-Id':String(office._id) } : {}), 'Content-Type':'application/json' }, ...(body ? { body:JSON.stringify(body) } : {}) });
      return { status:response.status, body:await response.json() };
    };
    await t.test('Admin sees selected office; no selection fallback uses own office', async () => {
      for (const office of [a,b]) {
        const result = await call('leads',admin,office); assert.equal(result.status,200); assert.equal(result.body.data.length,1); assert.equal(result.body.data[0].office,String(office._id));
        const users = await call('users',admin,office); assert.equal(users.status,200); assert(users.body.data.every(item => item.office === String(office._id)));
        const pipeline = await call('leads/pipeline',admin,office); assert.equal(pipeline.status,200, JSON.stringify(pipeline.body));
        const stats = await call('dashboard/stats',admin,office); assert.equal(stats.status,200, JSON.stringify(stats.body));
      }
      assert.equal((await call('leads',admin)).body.data[0].office,String(a._id));
    });
    await t.test('Session identity and office bootstrap ignore a stale browser office; business access stays strict', async () => {
      const stale = { _id:new mongoose.Types.ObjectId() };
      assert.equal((await call('auth/me',admin,stale)).status,200);
      assert.equal((await call('offices',admin,stale)).status,200);
      assert.equal((await call('auth/logout',admin,stale,'POST',{})).status,200);
      assert.equal((await call('auth/me',managerA,stale)).status,200);
      assert.equal((await call('leads',admin,stale)).status,404);
      assert.equal((await call('leads',managerA,stale)).status,403);
    });
    await t.test('Normal user cannot forge an office header or open/edit another office record', async () => {
      assert.equal((await call('leads',managerA,b)).status,403);
      assert.equal((await call(`leads/${leads[1]._id}`,managerA,a)).status,404);
      assert.equal((await call(`leads/${leads[1]._id}`,admin,a,'PUT',{ name:'tamper' })).status,404);
      assert.equal((await call('offices',managerA,a)).status,403);
    });
    await t.test('Public enquiry requires active office and IVRS remains globally unique', async () => {
      const body = { name:'Customer', contact:'4567890123', enquiryType:'Sales Enquiry', office:String(b._id), ivrsNo:'PUBLICIND' };
      assert.equal((await call('enquiries',null,null,'POST',{ ...body, office:'' })).status,400);
      const saved = await call('enquiries',null,null,'POST',body); assert.equal(saved.status,201,JSON.stringify(saved.body)); assert.equal(saved.body.data.office,String(b._id));
      assert.equal((await call('enquiries',null,null,'POST',{ ...body, office:String(a._id) })).status,409);
      const result = await call('enquiries',admin,a); assert.equal(result.body.data.length,0);
    });
    await t.test('Registration keeps office; duplicate email is global; user transfer denied', async () => {
      const body = { name:'Registrant', email:'register@test.local', password:'test12345', phone:'9876543210', role:'Sales Executive', office:String(b._id) };
      const result = await call('auth/register',null,null,'POST',body); assert.equal(result.status,201,JSON.stringify(result.body)); assert.equal(result.body.data.office,String(b._id)); assert.equal(result.body.data.approvalStatus,'pending');
      const duplicate = await call('auth/register',null,null,'POST',{ ...body, office:String(a._id) }); assert([400,409].includes(duplicate.status));
      assert.equal((await call(`users/${managerA._id}`,admin,a,'PUT',{ office:String(b._id) })).status,400);
    });
    await t.test('Stock is independent; assignment and direct service access cannot cross offices', async () => {
      for (const office of [a,b]) { const result = await call('product',admin,office,'POST',{ name:'Panel', category:'Panel', quantity:10, price:100 }); assert.equal(result.status,201,JSON.stringify(result.body)); }
      assert.equal((await call('product',admin,a)).body.data.length,1);
      const data = { customerName:'Service customer', contact:'4567890123', issue:'Cleaning', assignedTo:String(serviceB._id) };
      assert.equal((await call('service-requests',admin,a,'POST',data)).status,400);
      const result = await call('service-requests',admin,b,'POST',data); assert.equal(result.status,201,JSON.stringify(result.body));
      assert.equal((await call(`service-requests/${result.body.data._id}`,serviceA,a)).status,404);
      await assert.rejects(runOffice(a._id, () => Lead.findByIdAndUpdate(leads[0]._id,{ assignedTo:managerB._id })), /current office/);
    });
    await t.test('Fail closed without context; aggregate/count/distinct and notifications are scoped', async () => {
      await assert.rejects(Lead.find(), /office must be selected/);
      assert.equal(await runOffice(a._id, () => Lead.countDocuments()),1);
      assert.deepEqual(await runOffice(b._id, () => Lead.distinct('name')),['Indore Office']);
      const grouped = await runOffice(a._id, () => Lead.aggregate([{ $group:{ _id:null,count:{ $sum:1 } } }])); assert.equal(grouped[0].count,1);
      await runGlobal(() => User.findByIdAndUpdate(admin._id,{ $push:{ notifications:{ $each:[{ office:a._id,message:'A' },{ office:b._id,message:'B' }] } } }));
      const notifications = await call('users/notifications',admin,b); assert.equal(notifications.status,200,JSON.stringify(notifications.body)); assert(notifications.body.data.every(n => n.office === String(b._id)));
      const read = await call('users/notifications/read',admin,b,'PUT',{}); assert.equal(read.status,200);
      const own = await call('auth/me',admin,b); assert.equal(own.status,200,JSON.stringify(own.body)); assert.equal(own.body.user.email,admin.email);
      const update = await call('users/me',admin,b,'PUT',{ name:'Renamed Admin' }); assert.equal(update.status,200,JSON.stringify(update.body));
    });
    await t.test('Local file links require short-lived access issued by an authorized record response', async () => {
      await mongoose.connection.db.collection('officefiles').insertOne({ _id:'/uploads/test.pdf', office:a._id });
      await runOffice(a._id, () => User.findByIdAndUpdate(managerA._id, { documents:'/uploads/test.pdf' }));
      const result = await call(`users/${managerA._id}`,admin,a);
      assert.match(result.body.data.documents, /access=/);
      const base = `http://127.0.0.1:${server.address().port}`;
      assert.equal((await fetch(`${base}/uploads/test.pdf`)).status,403);
      assert.equal((await fetch(`${base}${result.body.data.documents}`)).status,200);
      const link = new URL(result.body.data.documents,base); link.searchParams.set('access','forged');
      assert.equal((await fetch(link)).status,403);
      assert.equal((await call(`users/${managerA._id}`,admin,b)).status,404);
    });
    await t.test('New cloud assets use private office folders and reject another office file key', async () => {
      const provider = require('../services/storage/storageService');
      const savedUpload = provider.upload, savedUrl = provider.getUrl;
      try {
        let options;
        provider.upload = async (file, value) => { options = value; return { url:'https://files.test/private', key:`root/${value.folder}/photo`, provider:'cloudinary', resourceType:'image', deliveryType:value.type }; };
        provider.getUrl = async (_key,value) => { assert.equal(value.signedDownload,true); assert.equal(value.format,'png'); return 'https://files.test/signed'; };
        const { uploadFileAsset, withFreshFileUrl } = require('../services/storage/fileAsset');
        const asset = await runOffice(a._id, () => uploadFileAsset({ originalname:'photo.png',mimetype:'image/png',size:1 },{ folder:'leads/test' }));
        assert.equal(options.type,'private'); assert(options.folder.includes(`offices/${a._id}/`));
        assert.equal((await withFreshFileUrl(asset)).fileUrl,'https://files.test/signed');
        await assert.rejects(runOffice(b._id, async () => { const lead = await Lead.findById(leads[1]._id); lead.salesExecutiveData.photoOneFile = asset; await lead.save(); }),/another office/);
      } finally { provider.upload = savedUpload; provider.getUrl = savedUrl; }
    });
    await t.test('Office ordering inserts, moves and appends positions and rejects invalid changes', async () => {
      const create = await call('offices',admin,a,'POST',{ name:'Neemuch',code:'NMC',order:1 });
      assert.equal(create.status,201,JSON.stringify(create.body));
      const c = create.body.data;
      let all = (await call('offices',admin,a)).body.data;
      assert.deepEqual(all.map(item => item.code),['NMC','RTM','IND']);
      assert.deepEqual(all.map(item => item.order),[1,2,3]);
      const stale = await call(`offices/${b._id}`,admin,a,'PUT',{order:1,expectedOrder:[String(a._id),String(b._id)]}); assert.equal(stale.status,409);
      assert.deepEqual((await call('offices',admin,a)).body.data.map(item => item.code),['NMC','RTM','IND']);
      const moved = await call(`offices/${b._id}`,admin,a,'PUT',{ order:1 }); assert.equal(moved.status,200);
      all = (await call('offices',admin,a)).body.data;
      assert.deepEqual(all.map(item => item.code),['IND','NMC','RTM']);
      await call(`offices/${b._id}`,admin,a,'PUT',{ order:3 });
      all = (await call('offices',admin,a)).body.data;
      assert.deepEqual(all.map(item => item.code),['NMC','RTM','IND']);
      await call(`offices/${a._id}`,admin,a,'PUT',{ order:1 });
      assert.deepEqual((await call('offices/public')).body.data.map(item => item.code),['RTM','NMC','IND']);
      for (const order of [0,-1,1.5,4,'not a number',null,true,{},[]]) assert.equal((await call(`offices/${a._id}`,admin,a,'PUT',{ order })).status,400);
      const before = (await call('offices',admin,a)).body.data.map(item => [item.code,item.order]);
      assert.equal((await call(`offices/${b._id}`,admin,a,'PUT',{ order:1,code:'RTM' })).status,400);
      assert.deepEqual((await call('offices',admin,a)).body.data.map(item => [item.code,item.order]),before);
      assert.equal((await call(`offices/${b._id}`,managerA,a,'PUT',{ order:1 })).status,403);
      const d = await call('offices',admin,a,'POST',{ name:'Ujjain',code:'UJN' }); assert.equal(d.status,201); assert.equal(d.body.data.order,4);
      await Office.deleteOne({ _id:d.body.data._id }); await Office.deleteOne({ _id:c._id });
      await call(`offices/${b._id}`,admin,a,'PUT',{ order:2 });
    });
    await t.test('Inactive office remains readable by Admin, blocks normal users and new work', async () => {
      assert.equal((await call(`offices/${b._id}`,admin,a,'PUT',{ isActive:false })).status,200);
      assert.equal((await call('leads',admin,b)).status,200);
      assert.equal((await call('leads',managerB,b)).status,403);
      assert.equal((await call('product',admin,b,'POST',{ name:'X', category:'X' })).status,403);
      assert.equal((await call('enquiries',null,null,'POST',{ name:'X', contact:'4567890123', enquiryType:'Sales Enquiry', office:String(b._id) })).status,400);
      assert(!(await call('offices/public')).body.data.some(item => item._id === String(b._id)));
      assert.equal((await call(`offices/${a._id}`,admin,a,'PUT',{ isActive:false })).status,400);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === dbName && dbName.startsWith('solarcrm_office_test_')) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
