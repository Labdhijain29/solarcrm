// Restore into a NEW local database only. Never overwrites the working database.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { MongoClient, BSON } = require('mongodb');
require('dotenv').config({ path:path.join(__dirname,'../.env') });

async function main() {
  const [backup, target] = process.argv.slice(2);
  if (!backup || !/^solarcrm_recovered_[a-zA-Z0-9_-]+$/.test(target || '')) throw new Error('Usage: node config/restore-office-backup-local.js <database.ejson.gz> <solarcrm_recovered_NAME>');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/solarcrm';
  const url = new URL(uri);
  if (url.protocol !== 'mongodb:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.searchParams.has('replicaSet')) throw new Error('Only standalone local MongoDB is supported.');
  const client = await MongoClient.connect(uri);
  try {
    if ((await client.db('admin').admin().listDatabases()).databases.some(db => db.name === target)) throw new Error('Target already exists. Choose a new recovery database name.');
    const snapshot = BSON.EJSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(backup))).toString(), { relaxed:false });
    const db = client.db(target);
    for (const entry of snapshot) {
      await db.createCollection(entry.name, entry.options);
      const collection = db.collection(entry.name);
      if (entry.documents.length) await collection.insertMany(entry.documents);
      for (const index of entry.indexes.filter(item => item.name !== '_id_')) {
        const { key, v, ns, ...options } = index;
        await collection.createIndex(key, options);
      }
      const sort = documents => documents.sort((a,b) => String(a._id).localeCompare(String(b._id)));
      if (BSON.EJSON.stringify(sort(await collection.find().toArray()),{ relaxed:false }) !== BSON.EJSON.stringify(sort(entry.documents),{ relaxed:false })) throw new Error(`Restore verification failed: ${entry.name}`);
    }
    console.log(`Restored and verified ${snapshot.length} collections in ${target}. Working database unchanged.`);
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
