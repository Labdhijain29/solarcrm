const Lead = require('../models/Lead');
const Counter = require('../models/Counter');

const getNextLeadId = async () => {
  const counter = await Counter.findById('leadId');
  if (!counter) {
    const maxLead = await Lead.findOne({ leadId: { $exists: true, $ne: null } })
      .sort({ leadId: -1 }).select('leadId').lean();
    try {
      await Counter.create({ _id: 'leadId', seq: Math.max(Number(maxLead?.leadId || 999), 999) });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  const updated = await Counter.findByIdAndUpdate(
    'leadId', { $inc: { seq: 1 } }, { new: true, upsert: true }
  );
  return Math.max(Number(updated.seq || 0), 1000);
};

module.exports = { getNextLeadId };
