const mongoose = require('mongoose');
const HOLD_STAGES = ['Name Change', 'Registration', 'Bank Approval', 'Loan Disbursement', 'Dispatch', 'Installation'];

// Serialize stage/status transitions across workers, including dispatch approval.
// Fail closed after a crash: no TTL may unlock an unfinished workflow write.
async function acquireLeadWorkflowLock(id) {
  const key = new mongoose.Types.ObjectId(String(id));
  const token = new mongoose.Types.ObjectId();
  const locks = mongoose.connection.db.collection('lead_workflow_locks');
  try { await locks.insertOne({ _id: key, token, startedAt: new Date() }); }
  catch (error) {
    if (error.code === 11000) throw Object.assign(new Error('This lead is being updated. Please refresh and try again.'), { statusCode: 409 });
    throw error;
  }
  return () => locks.deleteOne({ _id: key, token });
}
function protectLeadTransition(handler) {
  return async (req, res) => {
    let release;
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid lead ID.' });
      release = await acquireLeadWorkflowLock(req.params.id);
      return await handler(req, res);
    } catch (error) {
      if (!res.headersSent) return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    } finally {
      if (release) await release().catch(error => console.error('Lead workflow lock cleanup failed:', error.message));
    }
  };
}
module.exports = { HOLD_STAGES, acquireLeadWorkflowLock, protectLeadTransition };
