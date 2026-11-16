// Local-only audit, backup, normalization and IVRS indexes. Preview unless --apply.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient, BSON } = require('mongodb');
const { normalizeIvrs, ivrsIndexOptions } = require('../services/ivrsUniqueness');

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/solarcrm(?:\?|$)/.test(uri)) {
    throw new Error('This setup script only permits the local solarcrm database.');
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const docs = {}, indexes = {}, seen = new Map(), changes = [];
    for (const name of ['leads', 'enquiries']) {
      docs[name] = await db.collection(name).find({}, { promoteValues: false }).toArray();
      indexes[name] = await db.collection(name).listIndexes().toArray();
      for (const doc of docs[name]) {
        const number = normalizeIvrs(doc.ivrsNo);
        if (number && !/^[A-Z0-9]{1,15}$/.test(number)) throw new Error(`Invalid existing IVRS on ${name}/${doc._id}`);
        if (number) {
          if (!seen.has(number)) seen.set(number, []);
          seen.get(number).push({ name, doc });
        }
        if (doc.ivrsNo != null && number !== doc.ivrsNo) changes.push({ name, id: doc._id, before: doc.ivrsNo, after: number });
      }
    }
    for (const entries of seen.values()) {
      if (entries.length < 2) continue;
      const lead = entries.find(e => e.name === 'leads')?.doc;
      const enquiry = entries.find(e => e.name === 'enquiries')?.doc;
      if (entries.length !== 2 || !lead || !enquiry ||
        (String(lead.sourceEnquiry || '') !== String(enquiry._id) && String(enquiry.convertedTo || '') !== String(lead._id))) {
        throw new Error('Existing duplicate IVRS values found. No data was changed.');
      }
    }
    console.log(JSON.stringify({ database: db.databaseName, leads: docs.leads.length, enquiries: docs.enquiries.length, normalizationChanges: changes.length, mode: process.argv.includes('--apply') ? 'apply' : 'preview' }));
    if (!process.argv.includes('--apply')) return;
    const folder = path.resolve(__dirname, '../backups', `ivrs-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, 'before.ejson');
    const backup = BSON.EJSON.stringify({ docs, indexes, changes }, { relaxed: false });
    fs.writeFileSync(file, backup);
    if (fs.readFileSync(file, 'utf8') !== backup) throw new Error('Backup verification failed');
    for (const change of changes) {
      const result = await db.collection(change.name).updateOne({ _id: change.id, ivrsNo: change.before }, { $set: { ivrsNo: change.after } });
      if (result.matchedCount !== 1) throw new Error('Record changed during setup. Stop and review the backup.');
    }
    for (const name of ['leads', 'enquiries']) await db.collection(name).createIndex({ ivrsNo: 1 }, ivrsIndexOptions);
    console.log(JSON.stringify({ verifiedBackup: file, indexesCreated: ['leads.ivrsNo', 'enquiries.ivrsNo'] }));
  } finally {
    await client.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
