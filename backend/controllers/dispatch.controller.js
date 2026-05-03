const Product = require('../models/Product');
const Dispatch = require('../models/Dispatch');
const InventoryActivity = require('../models/InventoryActivity');
const Lead = require('../models/Lead');
const User = require('../models/User');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const normalizeMobile = (value) => normalizeDigits(value).replace(/^91(?=[6-9]\d{9}$)/, '');
const normalizeLookupText = (value) => String(value || '').trim();
const INSTALLATION_STATUSES = ['Pending', 'In Progress', 'Completed'];

const rollbackStock = async (updates) => {
  await Promise.all(updates.map((item) => Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } })));
};

const findDispatchLead = async (leadId, mobile) => {
  const term = normalizeLookupText(leadId);
  const digitTerm = normalizeDigits(term);
  const normalizedMobile = normalizeMobile(mobile);
  const lookupTerms = [term, digitTerm, normalizedMobile].filter(Boolean);
  if (!lookupTerms.length) return null;

  const or = [];
  lookupTerms.forEach((value) => {
    if (/^[0-9a-fA-F]{24}$/.test(value)) or.push({ _id: value });
    or.push(
      { ivrsNo: value },
      { phone: value },
      { 'salesExecutiveData.dealNo': value },
      { 'loanData.applicationId': value }
    );
  });

  const shortId = term.toLowerCase();
  if (/^[0-9a-f]{6}$/.test(shortId)) {
    or.push({
      $expr: {
        $eq: [
          { $substr: [{ $toString: '$_id' }, 18, 6] },
          shortId,
        ],
      },
    });
  }

  return Lead.findOne({ $or: or }).sort({ updatedAt: -1 });
};

exports.createDispatch = async (req, res) => {
  const decremented = [];
  let dispatch = null;

  try {
    const { customerName, leadId, engineerName, siteAddress, dispatchDate } = req.body;
    const billNo = String(req.body.billNo || '').trim() || `DSP-${Date.now()}`;
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
      return res.status(404).json({ success: false, message: 'Lead not found. Enter valid Lead ID, IVRS number, deal number or mobile.' });
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
        price: Number(product.price || 0),
        lineTotal: Number(product.price || 0) * item.quantity,
        remainingQuantity: Math.max(Number(product.quantity || 0) - item.quantity, 0),
      });
    }

    const grandTotal = snapshots.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);

    dispatch = await Dispatch.create({
      billNo,
      customerName,
      leadId: lead?._id?.toString() || leadId || '',
      engineerName,
      siteAddress,
      mobile,
      dispatchDate: dispatchDate || new Date(),
      items: snapshots,
      subTotal: grandTotal,
      grandTotal,
      approvalStatus: 'Pending',
      billLocked: false,
      installationStatus: 'Pending',
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    await InventoryActivity.create({
      action: 'Stock Dispatched',
      dispatch: dispatch._id,
      message: `Bill ${billNo}: ${snapshots.length} materials dispatched to ${customerName}`,
      quantityChange: -snapshots.reduce((sum, item) => sum + item.quantity, 0),
      performedBy: req.user._id,
      performedByName: req.user.name,
    });

    res.status(201).json({ success: true, message: 'Dispatch created, bill generated and stock reduced', data: dispatch });
  } catch (err) {
    await rollbackStock(decremented);
    if (dispatch?._id) await Dispatch.findByIdAndDelete(dispatch._id).catch(console.error);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveDispatch = async (req, res) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ success: false, message: 'Dispatch not found' });
    if (dispatch.approvalStatus === 'Approved') {
      return res.json({ success: true, message: 'Dispatch already approved', data: dispatch });
    }

    dispatch.approvalStatus = 'Approved';
    dispatch.billLocked = true;
    dispatch.approvedAt = new Date();
    dispatch.approvedBy = req.user._id;
    dispatch.approvedByName = req.user.name;
    await dispatch.save();

    const lead = await findDispatchLead(dispatch.leadId, dispatch.mobile);
    if (lead && lead.currentStage === 'Dispatch') {
      lead.dispatchData = {
        ...lead.dispatchData,
        panels: dispatch.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        inverter: dispatch.items.find(item => item.category === 'INVERTER (ON-GRID)')?.productName || lead.dispatchData?.inverter || '',
        trackingId: dispatch._id.toString(),
        billNo: dispatch.billNo,
        items: dispatch.items,
        dispatchedAt: dispatch.dispatchDate || new Date(),
      };
      lead.approveStage(req.user._id, req.user.name, `Dispatch bill ${dispatch.billNo} approved`);

      const installationManager = await User.findOne({ role: 'Installation Manager', isActive: true }).sort({ createdAt: 1 });
      lead.assignedTo = installationManager ? installationManager._id : null;
      await lead.save();

      if (installationManager) {
        await User.findByIdAndUpdate(installationManager._id, {
          $push: { notifications: { message: `Approved dispatch ${dispatch.billNo} is ready for installation` } }
        });
      }
    } else {
      const installationManagers = await User.find({ role: 'Installation Manager', isActive: true }).select('_id');
      await User.updateMany(
        { _id: { $in: installationManagers.map(user => user._id) } },
        { $push: { notifications: { message: `Approved dispatch ${dispatch.billNo} is ready for installation` } } }
      );
    }

    res.json({ success: true, message: 'Dispatch approved and sent to Installation Manager', data: dispatch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateInstallationStatus = async (req, res) => {
  try {
    const status = req.body.status;
    if (!INSTALLATION_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid installation status required.' });
    }

    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ success: false, message: 'Dispatch not found' });
    if (dispatch.approvalStatus !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Only approved dispatches can be tracked for installation.' });
    }

    dispatch.installationStatus = status;
    dispatch.installationUpdatedAt = new Date();
    dispatch.installationUpdatedBy = req.user._id;
    dispatch.installationUpdatedByName = req.user.name;
    await dispatch.save();

    res.json({ success: true, message: 'Installation status updated', data: dispatch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDispatches = async (req, res) => {
  try {
    const q = {};
    if (req.query.leadId) q.leadId = req.query.leadId;
    if (req.query.approvalStatus) q.approvalStatus = req.query.approvalStatus;
    if (req.query.installationStatus) q.installationStatus = req.query.installationStatus;
    if (req.query.search) {
      q.$or = [
        { customerName: new RegExp(req.query.search, 'i') },
        { billNo: new RegExp(req.query.search, 'i') },
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
