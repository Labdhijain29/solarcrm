// Local only. No remote override is provided. Back up and verify a restore before tagging records.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { MongoClient, ObjectId, BSON } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/solarcrm';
  const url = new URL(uri);
  if (url.protocol !== 'mongodb:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.searchParams.has('replicaSet')) throw new Error('Refusing migration: a standalone local MongoDB connection is required.');
  const dbName = url.pathname.slice(1);
  if (!dbName || !/^[a-zA-Z0-9_-]+$/.test(dbName)) throw new Error('Invalid local database name.');
  const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = client.db(dbName);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = path.join(__dirname, '../backups', `offices-${stamp}`);
  fs.mkdirSync(directory, { recursive: true });
  const snapshot = [];
  let restore;
  try {
    for (const info of await db.listCollections({ type: 'collection' }).toArray()) {
      const collection = db.collection(info.name);
      snapshot.push({ name: info.name, options: info.options, indexes: await collection.indexes(), documents: await collection.find().toArray() });
    }
    const serialized = BSON.EJSON.stringify(snapshot, { relaxed: false });
    const backup = path.join(directory, 'database.ejson.gz');
    fs.writeFileSync(backup, zlib.gzipSync(serialized));
    const parsed = BSON.EJSON.parse(zlib.gunzipSync(fs.readFileSync(backup)).toString(), { relaxed: false });
    const restoreName = `${dbName}_office_restore_${Date.now()}`;
    restore = client.db(restoreName);
    for (const entry of parsed) {
      await restore.createCollection(entry.name, entry.options);
      const collection = restore.collection(entry.name);
      if (entry.documents.length) await collection.insertMany(entry.documents);
      for (const index of entry.indexes.filter(i => i.name !== '_id_')) {
        const { key, v, ns, ...options } = index;
        await collection.createIndex(key, options);
      }
      const restored = await collection.find().sort({ _id: 1 }).toArray();
      const original = await db.collection(entry.name).find().sort({ _id: 1 }).toArray();
      if (BSON.EJSON.stringify(restored, { relaxed: false }) !== BSON.EJSON.stringify(original, { relaxed: false })) throw new Error(`Restore mismatch: ${entry.name}`);
    }
    // Only this newly created, local verification database is deleted.
    if (!restore.databaseName.startsWith(`${dbName}_office_restore_`)) throw new Error('Unexpected restore target');
    await restore.dropDatabase(); restore = null;
    const office = await db.collection('offices').findOne({ code: 'RTM' });
    const officeId = office?._id || new ObjectId();
    if (!office) await db.collection('offices').insertOne({ _id: officeId, name: 'Ratlam Office', code: 'RTM', city: 'Ratlam', state: 'Madhya Pradesh', address: '', pincode: '', phone: '', email: '', isActive: true, createdAt: new Date(), updatedAt: new Date(), __v: 0 });
    const offices = await db.collection('offices').find().toArray();
    const rank = item => Number.isSafeInteger(item.order) && item.order > 0 ? item.order : item.code === 'RTM' ? 1 : Number.MAX_SAFE_INTEGER;
    offices.sort((a,b) => rank(a) - rank(b) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a._id).localeCompare(String(b._id)));
    for (let index = 0; index < offices.length; index++) if (offices[index].order !== index + 1) await db.collection('offices').updateOne({ _id:offices[index]._id }, { $set:{ order:index + 1 } });
    const owned = ['users', 'leads', 'enquiries', 'servicerequests', 'products', 'dispatches', 'inventoryactivities'];
    const counts = {};
    for (const name of owned) {
      const collection = db.collection(name);
      const before = await collection.countDocuments();
      const result = await collection.updateMany({ office: null }, { $set: { office: officeId } });
      const after = await collection.countDocuments();
      if (before !== after || await collection.countDocuments({ office: null })) throw new Error(`Migration audit failed: ${name}`);
      counts[name] = { before, tagged: result.modifiedCount, after };
    }
    await db.collection('users').updateMany({}, { $set: { 'notifications.$[item].office': officeId } }, { arrayFilters: [{ 'item.office': { $exists: false } }] });
    const registerFiles = async (value, owner) => {
      if (typeof value === 'string' && /^\/?uploads\//.test(value)) {
        const file = `/${value.replace(/^\//, '').split('?')[0]}`;
        await db.collection('officefiles').updateOne({ _id:file }, { $setOnInsert:{ office:owner } }, { upsert:true });
      } else if (value && typeof value === 'object') for (const child of Object.values(value)) await registerFiles(child, owner);
    };
    for (const name of owned) for (const document of await db.collection(name).find().toArray()) await registerFiles(document, document.office);
    for (const entry of snapshot.filter(item => owned.includes(item.name))) {
      for (const old of entry.documents) {
        const current = await db.collection(entry.name).findOne({ _id: old._id });
        delete current.office;
        if (entry.name === 'users') for (const n of current.notifications || []) { if (!(old.notifications || []).find(o => String(o._id) === String(n._id))?.office) delete n.office; }
        const { office: oldOffice, ...expected } = old;
        if (BSON.EJSON.stringify(current, { relaxed: false }) !== BSON.EJSON.stringify(expected, { relaxed: false })) throw new Error(`Unexpected data change: ${entry.name}/${old._id}`);
      }
    }
    // Product identity is per office. Create the replacement before dropping
    // only the old global identity index; retain all other indexes.
    await db.collection('products').createIndex({ office: 1, name: 1, category: 1, brand: 1, type: 1, capacity: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
    for (const index of await db.collection('products').indexes()) {
      if (index.unique && JSON.stringify(index.key) === JSON.stringify({ name: 1, category: 1, brand: 1, type: 1, capacity: 1 })) await db.collection('products').dropIndex(index.name);
    }
    for (const name of owned) await db.collection(name).createIndex({ office: 1 });
    await db.collection('offices').createIndex({ code: 1 }, { unique: true });
    const audit = { database: dbName, officeId: String(officeId), restoreVerified: true, backup, sha256: crypto.createHash('sha256').update(fs.readFileSync(backup)).digest('hex'), counts, completedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(directory, 'audit.json'), JSON.stringify(audit, null, 2));
    console.log(JSON.stringify(audit, null, 2));
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
