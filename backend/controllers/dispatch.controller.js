const Product = require('../models/Product');
const Dispatch = require('../models/Dispatch');
const InventoryActivity = require('../models/InventoryActivity');
const Lead = require('../models/Lead');
const User = require('../models/User');

const normalizeMobile = (value) => String(value || '').replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, '');

const rollbackStock = async (updates) => {
  await Promise.all(updates.map((item) => Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } })));
};

const findDispatchLead = async (leadId, mobile) => {
  const term = String(leadId || '').trim();
  if (!term) return null;

  const or = [];
  if (term) {
    if (/^[0-9a-fA-F]{24}$/.test(term)) or.push({ _id: term });
    or.push({ ivrsNo: term }, { phone: term });
  }

  return Lead.findOne({ $or: or }).sort({ updatedAt: -1 });
};

exports.createDispatch = async (req, res) => {
  const decremented = [];
  let dispatch = null;

  try {
    const { customerName, leadId, engineerName, siteAddress, dispatchDate } = req.body;
    const mobile = normalizeMobile(req.body.mobile);
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!customerName || !engineerName || !siteAddress || !mobile) {
      return res.status(400).json({ success: false, message: 'Customer, engineer, site address and mobile are required.' });
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number.' });
    }
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'Select at least one material.' });
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
    }));

    if (normalizedItems.some(item => !item.productId || item.quantity <= 0)) {
      return res.status(400).json({ success: false, message: 'Every selected material needs a valid quantity.' });
    }

    const lead = await findDispatchLead(leadId, mobile);
    if (leadId && !lead) {
      return res.status(404).json({ success: false, message: 'Lead not found. Enter valid Lead ID or IVRS number.' });
    }
    if (lead && lead.status !== 'active') {
      return res.status(400).json({ success: false, message: `Lead is already ${lead.status}.` });
    }
    if (lead && lead.currentStage !== 'Dispatch') {
      return res.status(400).json({ success: false, message: `Lead is at '${lead.currentStage}' stage. Dispatch can be submitted only at 'Dispatch' stage.` });
    }

    const snapshots = [];
    for (const item of normalizedItems) {
      const product = await Product.findOneAndUpdate(
        { _id: item.productId, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity }, $set: { updatedBy: req.user._id } },
        { new: false }
      );

      if (!product) {
        await rollbackStock(decremented);
        return res.status(400).json({ success: false, message: 'Insufficient Stock' });
      }

      decremented.push(item);
      snapshots.push({
        productId: product._id,
        productName: product.name,
        category: product.category,
        brand: product.brand,
        type: product.type,
        capacity: product.capacity,
        unit: product.unit,
        quantity: item.quantity,
      });
    }

    dispatch = await Dispatch.create({
      customerName,
      leadId: lead?._id?.toString() || leadId || '',
      engineerName,
      siteAddress,
      mobile,
      dispatchDate: dispatchDate || new Date(),
      items: snapshots,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    await InventoryActivity.create({
      action: 'Stock Dispatched',
      dispatch: dispatch._id,
      message: `${snapshots.length} materials dispatched to ${customerName}`,
      quantityChange: -snapshots.reduce((sum, item) => sum + item.quantity, 0),
      performedBy: req.user._id,
      performedByName: req.user.name,
    });

    if (lead) {
      lead.dispatchData = {
        ...lead.dispatchData,
        panels: snapshots.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        inverter: snapshots.find(item => item.category === 'INVERTER (ON-GRID)')?.productName || lead.dispatchData?.inverter || '',
        trackingId: dispatch._id.toString(),
        dispatchedAt: dispatch.dispatchDate || new Date(),
      };
      lead.approveStage(req.user._id, req.user.name, `Dispatch submitted: ${snapshots.length} materials`);

      const installationManager = await User.findOne({ role: 'Installation Manager', isActive: true }).sort({ createdAt: 1 });
      lead.assignedTo = installationManager ? installationManager._id : null;
      await lead.save();

      if (installationManager) {
        await User.findByIdAndUpdate(installationManager._id, {
          $push: { notifications: { message: `Lead ${lead.name} moved to Installation stage after dispatch` } }
        });
      }
    }

    res.status(201).json({ success: true, message: 'Dispatch saved and stock reduced', data: dispatch });
  } catch (err) {
    await rollbackStock(decremented);
    if (dispatch?._id) await Dispatch.findByIdAndDelete(dispatch._id).catch(console.error);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDispatches = async (req, res) => {
  try {
    const q = {};
    if (req.query.leadId) q.leadId = req.query.leadId;
    if (req.query.search) {
      q.$or = [
        { customerName: new RegExp(req.query.search, 'i') },
        { leadId: new RegExp(req.query.search, 'i') },
        { engineerName: new RegExp(req.query.search, 'i') },
        { mobile: new RegExp(req.query.search, 'i') },
      ];
    }

    const dispatches = await Dispatch.find(q).sort({ dispatchDate: -1, createdAt: -1 });
    const totalMaterialDispatched = dispatches.reduce(
      (sum, dispatch) => sum + dispatch.items.reduce((inner, item) => inner + Number(item.quantity || 0), 0),
      0
    );

    res.json({ success: true, data: dispatches, summary: { totalDispatches: dispatches.length, totalMaterialDispatched } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDispatchesByLead = async (req, res) => {
  try {
    const dispatches = await Dispatch.find({ leadId: req.params.leadId }).sort({ dispatchDate: -1 });
    res.json({ success: true, data: dispatches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
