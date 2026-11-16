const mongoose = require('mongoose');

const normalizeIvrs = value => String(value ?? '').trim().toUpperCase();
const conflict = message => Object.assign(new Error(message), { statusCode: 409 });

// A unique MongoDB _id serializes saves of the same number across API workers
// and both collections. No TTL: a crashed writer must fail closed, not unlock
// while its database write could still be running.
async function withUniqueIvrs({ value, leadId, enquiryId }, write) {
  const ivrsNo = normalizeIvrs(value);
  if (ivrsNo && !/^[A-Z0-9]{1,15}$/.test(ivrsNo)) {
    throw Object.assign(new Error('IVRS number must be up to 15 letters or digits.'), { statusCode: 400 });
  }
  if (!ivrsNo) return write('');
  const db = mongoose.connection.db;
  const locks = db.collection('ivrs_write_locks');
  const token = new mongoose.Types.ObjectId();
  try {
    await locks.insertOne({ _id: ivrsNo, token, startedAt: new Date() });
  } catch (error) {
    if (error.code === 11000) throw conflict('This IVRS number is being saved. Please try again.');
    throw error;
  }
  try {
    // Older converted records may have only one side of the relationship.
    if (leadId && !enquiryId) {
      const linked = await db.collection('enquiries').findOne({ convertedTo: new mongoose.Types.ObjectId(String(leadId)) }, { projection: { _id: 1 } });
      enquiryId = linked?._id;
    } else if (enquiryId && !leadId) {
      const linked = await db.collection('leads').findOne({ sourceEnquiry: new mongoose.Types.ObjectId(String(enquiryId)) }, { projection: { _id: 1 } });
      leadId = linked?._id;
    }
    // Match legacy values too, before they have been trimmed/uppercased.
    const number = new RegExp(`^\\s*${ivrsNo}\\s*$`, 'i');
    for (const [collection, id] of [['leads', leadId], ['enquiries', enquiryId]]) {
      const query = { ivrsNo: number };
      if (id) query._id = { $ne: new mongoose.Types.ObjectId(String(id)) };
      if (await db.collection(collection).findOne(query, { projection: { _id: 1 } })) {
        throw conflict('This IVRS number already exists in another enquiry or lead.');
      }
    }
    return await write(ivrsNo);
  } finally {
    await locks.deleteOne({ _id: ivrsNo, token });
  }
}

const ivrsField = {
  type: String, default: '', set: normalizeIvrs,
  match: [/^[A-Z0-9]{0,15}$/, 'IVRS number must be up to 15 letters or digits.'],
};
const ivrsIndexOptions = {
  unique: true,
  partialFilterExpression: { ivrsNo: { $type: 'string', $gt: '' } },
  collation: { locale: 'en', strength: 2 },
};
module.exports = { normalizeIvrs, withUniqueIvrs, ivrsField, ivrsIndexOptions };
