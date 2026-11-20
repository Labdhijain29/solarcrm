const router = require('express').Router();
const Office = require('../models/Office');
const { protect, authorize } = require('../middleware/auth.middleware');
router.get('/public', async (_req, res, next) => {
  try { res.json({ success: true, data: await Office.find({ isActive: true }).select('name code order').sort({ order:1, createdAt:1, _id:1 }) }); } catch (error) { next(error); }
});
router.use(protect, authorize('Admin'));
router.get('/', async (_req, res, next) => {
  try { res.json({ success: true, data: await Office.find().sort({ order:1, createdAt:1, _id:1 }) }); } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try { const office = await Office.findById(req.params.id); if (!office) return res.status(404).json({ success: false, message: 'Office not found.' }); res.json({ success: true, data: office }); } catch (error) { next(error); }
});
async function save(req, res) {
  const locks = Office.db.collection('office_management_locks');
  const token = new (require('mongoose').Types.ObjectId)();
  let locked = false;
  let orderingPending = false;
  try {
    try { await locks.insertOne({ _id:'office-management', token, startedAt:new Date() }); locked = true; }
    catch (error) { if (error.code === 11000) return res.status(409).json({ success:false, message:'Another office is being updated. Please try again.' }); throw error; }
    const fields = ['name', 'code', 'address', 'state', 'city', 'pincode', 'phone', 'email', 'isActive'];
    const updates = Object.fromEntries(fields.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
    if (updates.isActive !== undefined && typeof updates.isActive !== 'boolean') throw new Error('Choose Active or Inactive.');
    if (updates.isActive === false && await Office.countDocuments({ isActive: true, _id: { $ne: req.params.id } }) === 0) throw new Error('Keep at least one office active.');
    const existing = await Office.find().sort({ order:1, createdAt:1, _id:1 });
    if (req.body.expectedOrder !== undefined && (!Array.isArray(req.body.expectedOrder) || req.body.expectedOrder.length !== existing.length || existing.some((item,index) => String(item._id) !== req.body.expectedOrder[index]))) throw Object.assign(new Error('Office order changed. The latest order has been loaded; please try again.'), { statusCode:409 });
    const office = req.params.id ? existing.find(item => String(item._id) === req.params.id) : new Office(updates);
    if (!office) return res.status(404).json({ success: false, message: 'Office not found.' });
    const currentPosition = existing.findIndex(item => String(item._id) === String(office._id));
    const suppliedOrder = req.body.order !== undefined && req.body.order !== '';
    const position = suppliedOrder ? Number(req.body.order) : currentPosition >= 0 ? currentPosition + 1 : existing.length + 1;
    const maximum = existing.length + (req.params.id ? 0 : 1);
    if ((suppliedOrder && !['number','string'].includes(typeof req.body.order)) || !Number.isSafeInteger(position) || position < 1 || position > maximum) throw new Error(`Choose an office order from 1 to ${maximum}.`);
    const ordered = existing.filter(item => String(item._id) !== String(office._id));
    ordered.splice(position - 1, 0, office);
    office.set({ ...updates, order:position });
    await office.validate();
    await locks.updateOne({ _id:'office-management', token }, { $set:{ orderPlan:ordered.map((item,index) => ({ office:item._id, order:index + 1 })) } });
    await office.save();
    orderingPending = true;
    const shifts = ordered.flatMap((item,index) => item.order === index + 1 ? [] : [{ updateOne:{ filter:{ _id:item._id }, update:{ $set:{ order:index + 1 } } } }]);
    if (shifts.length) await Office.bulkWrite(shifts);
    orderingPending = false;
    res.status(req.params.id ? 200 : 201).json({ success: true, data: office, message: 'Office saved.' });
  } catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.code === 11000 ? 'Office code already exists.' : error.errors ? Object.values(error.errors)[0].message : error.message }); }
  finally { if (locked && !orderingPending) await locks.deleteOne({ _id:'office-management', token }); }
}
router.post('/', save);
router.put('/:id', save);
module.exports = router;
