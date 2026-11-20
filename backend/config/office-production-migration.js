// Explicit, phased production migration. Reads the single COMMENTED URI; never
// changes .env or starts the application. Credentials are never written to logs.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { MongoClient, ObjectId, BSON } = require('mongodb');
const dotenv = require('dotenv');

const OWNED = ['users','leads','enquiries','servicerequests','products','dispatches','inventoryactivities'];
const HOST = 'myrishiganga.ld2tigh.mongodb.net';
const DATABASE = 'mahavirsolar';
const BACKUPS = path.resolve(__dirname,'../backups');
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
function canonical(value) {
  const plain = JSON.parse(BSON.EJSON.stringify(value,{ relaxed:false }));
  const sort = item => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key,sort(item[key])])) : item;
  return JSON.stringify(sort(plain));
}
const encode = value => BSON.EJSON.stringify(value,{ relaxed:false });
const decode = value => BSON.EJSON.parse(value,{ relaxed:false });
const clone = value => decode(encode(value));
const equal = (a,b) => canonical(a) === canonical(b);
function productionUri() {
  const text = fs.readFileSync(path.join(__dirname,'../.env'),'utf8');
  const candidates = [...text.matchAll(/^\s*#\s*(MONGODB_URI\s*=.*)$/gm)].map(match => dotenv.parse(match[1]).MONGODB_URI);
  if (candidates.length !== 1) throw new Error('Expected exactly one commented production connection.');
  const url = new URL(candidates[0]);
  if (url.protocol !== 'mongodb+srv:' || url.hostname !== HOST || url.pathname !== `/${DATABASE}`) throw new Error('Production target does not match the reviewed host/database.');
  return candidates[0];
}
async function documents(db,name) { return db.collection(name).find({}, { promoteValues:false }).sort({ _id:1 }).toArray(); }
async function snapshot(db) {
  const result = [];
  for (const info of (await db.listCollections().toArray()).sort((a,b) => a.name.localeCompare(b.name))) {
    if (info.type !== 'collection' || info.options?.timeseries || info.options?.capped) throw new Error(`Unsupported collection type/options: ${info.name}`);
    console.log(JSON.stringify({phase:'reading',collection:info.name}));
    result.push({ name:info.name, options:info.options, indexes:await db.collection(info.name).indexes(), documents:await documents(db,info.name) });
  }
  return result;
}
async function verifySnapshot(db, entries) {
  const current = await snapshot(db);
  if (!equal(current,entries)) throw new Error('Database changed since backup. Stop all writers and prepare a fresh backup.');
}
function localPaths(value, found = new Set()) {
  if (typeof value === 'string' && /^\/?uploads\//.test(value)) {
    const file = `/${value.replace(/^\//,'').split('?')[0]}`;
    if (file.includes('..') || file.includes('\\')) throw new Error('Unsafe legacy upload path needs review.');
    found.add(file);
  } else if (value && typeof value === 'object' && !value._bsontype && !(value instanceof Date)) for (const item of Object.values(value)) localPaths(item,found);
  return found;
}
function preflight(entries) {
  const byName = new Map(entries.map(entry => [entry.name,entry]));
  if ((byName.get('offices')?.documents.length || 0) !== 0 || (byName.get('officefiles')?.documents.length || 0) !== 0) throw new Error('Offices/file registry already exist. Review before preparing another production migration.');
  for (const name of OWNED) for (const doc of byName.get(name)?.documents || []) {
    if (doc.office != null) throw new Error(`Existing office assignments require review: ${name}`);
    if (name === 'users' && doc.notifications != null && !Array.isArray(doc.notifications)) throw new Error('Unexpected notifications format.');
    if (name === 'users' && doc.notifications?.some(item => item?.office != null)) throw new Error('Existing notification office assignments require review.');
  }
  for (const name of ['lead_workflow_locks','ivrs_write_locks','office_management_locks']) if (byName.get(name)?.documents.length) throw new Error(`Workflow writer lock remains: ${name}. Review before migration.`);
  const roles = require('../models/User').schema.path('role').enumValues;
  if (byName.get('users')?.documents.some(user => !roles.includes(user.role))) throw new Error('Production has a user role not supported by this code.');
  return { counts:Object.fromEntries(entries.map(entry => [entry.name,entry.documents.length])), legacyLocalFiles:new Set(OWNED.flatMap(name => (byName.get(name)?.documents || []).flatMap(doc => [...localPaths(doc)]))).size };
}
function expectedData(entries, office) {
  const expected = new Map(entries.map(entry => [entry.name,clone(entry.documents)]));
  const files = new Set();
  for (const name of OWNED) {
    const rows = expected.get(name) || [];
    for (const doc of rows) {
      doc.office = office._id;
      if (name === 'users') for (const item of doc.notifications || []) if (item.office == null) item.office = office._id;
      for (const file of localPaths(doc)) files.add(file);
    }
    expected.set(name,rows);
  }
  expected.set('offices',[clone(office)]);
  expected.set('officefiles',[...files].sort().map(file => ({ _id:file,office:office._id })));
  return expected;
}
function relationshipAudit(data) {
  const maps = new Map([...data].map(([name,rows]) => [name,new Map(rows.map(doc => [String(doc._id),doc]))]));
  const report = {};
  const links = { users:{ approvedBy:'users' }, leads:{ assignedTo:'users',salesExecutiveAssignee:'users',createdBy:'users',sourceEnquiry:'enquiries' }, enquiries:{ assignedTo:'users',createdBy:'users',convertedTo:'leads' }, servicerequests:{ assignedTo:'users',createdBy:'users' }, products:{ createdBy:'users',updatedBy:'users' }, dispatches:{ createdBy:'users',approvedBy:'users',installationAssignee:'users' }, inventoryactivities:{ product:'products',dispatch:'dispatches',performedBy:'users' } };
  for (const [name,fields] of Object.entries(links)) for (const [field,target] of Object.entries(fields)) {
    let present = 0, missing = 0, crossOffice = 0;
    for (const doc of data.get(name) || []) {
      if (!doc[field]) continue;
      present++;
      const linked = maps.get(target)?.get(String(doc[field]));
      if (!linked) missing++;
      else if (doc.office && linked.office && String(doc.office) !== String(linked.office)) crossOffice++;
    }
    if (present) report[`${name}.${field}`] = { present,missing,crossOffice };
  }
  return report;
}
async function createIndexes(db) {
  for (const name of OWNED) await db.collection(name).createIndex({ office:1 });
  await db.collection('offices').createIndex({ code:1 },{ unique:true });
  await db.collection('offices').createIndex({ order:1 });
  await db.collection('officefiles').createIndex({ office:1 });
  // Preserve the global identity index until the replacement is built successfully.
  await db.collection('products').createIndex({ office:1,name:1,category:1,brand:1,type:1,capacity:1 },{ unique:true,collation:{ locale:'en',strength:2 } });
}
async function migrate(db,office,entries,session) {
  await createIndexes(db);
  const expected = expectedData(entries,office);
  const task = async () => {
    const options = session ? { session } : {};
    await db.collection('offices').insertOne(clone(office),options);
    for (const name of OWNED) await db.collection(name).updateMany({ office:null },{ $set:{ office:office._id } },options);
    await db.collection('users').updateMany({ notifications:{ $type:'array' } },{ $set:{ 'notifications.$[item].office':office._id } },{ ...options,arrayFilters:[{ 'item.office':null }] });
    const files = expected.get('officefiles');
    if (files.length) await db.collection('officefiles').insertMany(clone(files),options);
  };
  if (session) await session.withTransaction(task,{ readConcern:{ level:'snapshot' },writeConcern:{ w:'majority' } });
  else await task();
  for (const index of await db.collection('products').indexes()) if (index.unique && equal(index.key,{ name:1,category:1,brand:1,type:1,capacity:1 })) await db.collection('products').dropIndex(index.name);
  return expected;
}
async function verifyMigration(db,entries,office) {
  const expected = expectedData(entries,office);
  const actual = new Map();
  const counts = {};
  for (const [name,expectedRows] of expected) {
    const rows = await documents(db,name);
    const sort = values => [...values].sort((a,b) => String(a._id).localeCompare(String(b._id)));
    if (!equal(sort(rows),sort(expectedRows))) throw new Error(`Unexpected document change: ${name}. Keep backend stopped.`);
    actual.set(name,rows); counts[name] = rows.length;
  }
  const beforeRelations = relationshipAudit(new Map(entries.map(entry => [entry.name,entry.documents])));
  const afterRelations = relationshipAudit(actual);
  for (const [key,value] of Object.entries(afterRelations)) if (value.crossOffice || value.missing !== beforeRelations[key]?.missing) throw new Error(`Relationship mismatch: ${key}`);
  for (const entry of entries) {
    const indexes = await db.collection(entry.name).indexes();
    for (const original of entry.indexes) {
      if (entry.name === 'products' && original.unique && equal(original.key,{ name:1,category:1,brand:1,type:1,capacity:1 })) continue;
      if (!indexes.some(index => equal(index,original))) throw new Error(`Existing index changed: ${entry.name}/${original.name}`);
    }
  }
  const names = new Set((await db.listCollections().toArray()).map(entry => entry.name));
  for (const name of names) if (!expected.has(name)) throw new Error(`Unexpected collection appeared: ${name}`);
  return { counts,relationships:afterRelations,allDocumentsMatchExpected:true,globalEmailIvrsIndexesPreserved:true };
}
function backupFolder(argument) {
  const directory = path.resolve(argument || '');
  if (!directory.startsWith(BACKUPS + path.sep) || !path.basename(directory).startsWith('production-offices-')) throw new Error('Use a production-offices backup folder under backend/backups.');
  return directory;
}
async function prepare(client) {
  const db = client.db(DATABASE);
  const entries = await snapshot(db);
  const report = preflight(entries);
  const directory = path.join(BACKUPS,`production-offices-${new Date().toISOString().replace(/[:.]/g,'-')}`);
  fs.mkdirSync(directory,{ recursive:true });
  const file = path.join(directory,'database.ejson.gz');
  fs.writeFileSync(file,zlib.gzipSync(encode(entries)),{ mode:0o600 });
  const saved = decode(zlib.gunzipSync(fs.readFileSync(file)).toString());
  if (!equal(saved,entries)) throw new Error('Backup read-back failed.');
  await verifySnapshot(db,entries);
  const timestamp = new Date();
  const office = { _id:new ObjectId(),name:'Ratlam Office',code:'RTM',order:1,address:'',state:'Madhya Pradesh',city:'Ratlam',pincode:'',phone:'',email:'',isActive:true,createdAt:timestamp,updatedAt:timestamp,__v:0 };
  const localName = `solarcrm_production_office_rehearsal_${Date.now()}`;
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017',{ serverSelectionTimeoutMS:5000 });
  try {
    if ((await local.db('admin').admin().listDatabases()).databases.some(item => item.name === localName)) throw new Error('Rehearsal target already exists.');
    const rehearsal = local.db(localName);
    for (const entry of saved) {
      await rehearsal.createCollection(entry.name,entry.options);
      if (entry.documents.length) await rehearsal.collection(entry.name).insertMany(clone(entry.documents));
      for (const index of entry.indexes.filter(item => item.name !== '_id_')) { const { key,v,ns,...options } = index; await rehearsal.collection(entry.name).createIndex(key,options); }
      if (!equal(await documents(rehearsal,entry.name),entry.documents)) throw new Error(`Restore mismatch: ${entry.name}`);
    }
    await migrate(rehearsal,office,saved);
    const validation = await verifyMigration(rehearsal,saved,office);
    const plan = { host:HOST,database:DATABASE,backupSha256:digest(fs.readFileSync(file)),sourceDigest:digest(entries),preparedAt:timestamp,office,report,localRehearsalDatabase:localName,restoreVerified:true,rehearsal:validation };
    fs.writeFileSync(path.join(directory,'plan.ejson'),encode(plan),{ mode:0o600 });
    fs.writeFileSync(path.join(directory,'prepare-audit.json'),JSON.stringify({ ...report,officeId:String(office._id),backup:file,backupSha256:plan.backupSha256,restoreVerified:true,rehearsalVerified:true,relationships:validation.relationships,localRehearsalDatabase:localName },null,2));
    console.log(JSON.stringify({ phase:'prepared',database:DATABASE,directory,counts:report.counts,legacyLocalFiles:report.legacyLocalFiles,restoreVerified:true,rehearsalVerified:true,officeId:String(office._id),preExistingMissingReferences:Object.entries(validation.relationships).filter(([,value]) => value.missing).map(([field,value]) => ({ field,count:value.missing })) },null,2));
  } finally { await local.close(); }
}
async function apply(client,argument) {
  if (!process.argv.includes('--backend-stopped')) throw new Error('Apply requires --backend-stopped after all backend instances and writers are stopped.');
  const directory = backupFolder(argument);
  const plan = decode(fs.readFileSync(path.join(directory,'plan.ejson'),'utf8'));
  if (plan.host !== HOST || plan.database !== DATABASE || !plan.restoreVerified) throw new Error('Unverified/wrong migration plan.');
  const file = path.join(directory,'database.ejson.gz');
  if (digest(fs.readFileSync(file)) !== plan.backupSha256) throw new Error('Backup checksum mismatch.');
  const entries = decode(zlib.gunzipSync(fs.readFileSync(file)).toString());
  if (digest(entries) !== plan.sourceDigest) throw new Error('Source digest mismatch.');
  const db = client.db(DATABASE);
  const completed = path.join(directory,'production-audit.json');
  if (fs.existsSync(completed)) { const validation = await verifyMigration(db,entries,plan.office); console.log(JSON.stringify({ phase:'already-applied',...validation },null,2)); return; }
  await verifySnapshot(db,entries);
  fs.writeFileSync(path.join(directory,'apply-started.json'),JSON.stringify({ host:HOST,database:DATABASE,startedAt:new Date().toISOString(),officeId:String(plan.office._id) },null,2));
  const session = client.startSession();
  try { await migrate(db,plan.office,entries,session); } finally { await session.endSession(); }
  const validation = await verifyMigration(db,entries,plan.office);
  const audit = { phase:'applied',host:HOST,database:DATABASE,completedAt:new Date().toISOString(),officeId:String(plan.office._id),backup:file,backupSha256:plan.backupSha256,...validation };
  fs.writeFileSync(completed,JSON.stringify(audit,null,2));
  console.log(JSON.stringify(audit,null,2));
}
async function main() {
  const [mode,argument] = process.argv.slice(2);
  if (!['prepare','apply','verify'].includes(mode)) throw new Error('Usage: node config/office-production-migration.js prepare | apply <backup-folder> --backend-stopped | verify <backup-folder>');
  console.log(JSON.stringify({phase:mode,host:HOST,database:DATABASE}));
  const client = new MongoClient(productionUri(),{ serverSelectionTimeoutMS:15000,connectTimeoutMS:10000,socketTimeoutMS:20000,maxPoolSize:3,writeConcern:{ w:'majority' } });
  try {
    await client.connect();
    console.log(JSON.stringify({phase:'connected',database:DATABASE}));
    if (mode === 'prepare') await prepare(client);
    else if (mode === 'apply') await apply(client,argument);
    else { const directory = backupFolder(argument); const plan = decode(fs.readFileSync(path.join(directory,'plan.ejson'),'utf8')); const entries = decode(zlib.gunzipSync(fs.readFileSync(path.join(directory,'database.ejson.gz'))).toString()); console.log(JSON.stringify({ phase:'verified',...await verifyMigration(client.db(DATABASE),entries,plan.office) },null,2)); }
  } finally { await client.close(); }
}
main().catch(error => { console.error(JSON.stringify({ name:error.name,code:error.code,message:String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[redacted connection]') })); process.exitCode=1; });
