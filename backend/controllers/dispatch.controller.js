const Product = require('../models/Product');
const Dispatch = require('../models/Dispatch');
const InventoryActivity = require('../models/InventoryActivity');
const Lead = require('../models/Lead');
const User = require('../models/User');

const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');
const normalizeMobile = (value) => normalizeDigits(value).replace(/^91(?=[6-9]\d{9}$)/, '');
const normalizeLookupText = (value) => String(value || '').trim();
const INSTALLATION_STATUSES = ['Pending', 'In Progress', 'Completed'];
const BILL_STATUSES = ['Draft', 'Hold', 'Pending'];
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rollbackStock = async (updates) => {
  await Promise.all(updates.map((item) => Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } })));
};

const rollbackStockDeltas = async (updates) => {
  await Promise.all(updates.map((item) => Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.delta } })));
};

const toMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const calculateLine = ({ quantity, price, discountPercent, gstPercent }) => {
  const gross = Number(quantity || 0) * Number(price || 0);
  const discountAmount = toMoney(gross * Number(discountPercent || 0) / 100);
  const taxableAmount = toMoney(Math.max(gross - discountAmount, 0));
  const gstAmount = toMoney(taxableAmount * Number(gstPercent || 0) / 100);
  return {
    discountAmount,
    taxableAmount,
    gstAmount,
    lineTotal: toMoney(taxableAmount + gstAmount),
  };
};
const calculateTotals = (items) => {
  const subTotal = toMoney(items.reduce((sum, item) => sum + Number(item.taxableAmount || 0), 0));
  const discountTotal = toMoney(items.reduce((sum, item) => sum + Number(item.discountAmount || 0), 0));
  const gstTotal = toMoney(items.reduce((sum, item) => sum + Number(item.gstAmount || 0), 0));
  const grandTotal = toMoney(items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const payableAmount = Math.round(grandTotal);
  const roundOff = toMoney(payableAmount - grandTotal);
  return { subTotal, discountTotal, gstTotal, grandTotal, roundOff, payableAmount };
};

const normalizeDispatchItems = (items) => {
  const itemMap = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const productId = String(item.productId || '').trim();
    const quantity = Number(item.quantity || 0);
    if (!productId || quantity <= 0) return;
    const current = itemMap.get(productId);
    itemMap.set(productId, {
      productId,
      quantity: Number(current?.quantity || 0) + quantity,
      price: Number(item.price || 0),
      discountPercent: Number(item.discountPercent || item.discount || 0),
      gstPercent: Number(item.gstPercent ?? item.gst ?? 0),
    });
  });

  return Array.from(itemMap.values());
};

const buildDispatchSnapshots = (products, normalizedItems) => {
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  return normalizedItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error('Selected stock item not found.');

    return {
      productId: product._id,
      productName: product.name,
      category: product.category,
      brand: product.brand,
      type: product.type,
      capacity: product.capacity,
      unit: product.unit,
      quantity: item.quantity,
      productCode: product.productCode || product.sku || product._id.toString().slice(-6).toUpperCase(),
      sku: product.sku || product.productCode || '',
      hsnCode: product.hsnCode || '',
      price: Number(item.price || product.salePrice || product.price || 0),
      discountPercent: Number(item.discountPercent || 0),
      gstPercent: Number(item.gstPercent || product.gstPercent || 0),
      ...calculateLine({
        quantity: item.quantity,
        price: Number(item.price || product.salePrice || product.price || 0),
        discountPercent: Number(item.discountPercent || 0),
        gstPercent: Number(item.gstPercent || product.gstPercent || 0),
      }),
      remainingQuantity: Number(product.quantity || 0),
    };
  });
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

const findInstallationAssignee = async (engineerName) => {
  const name = normalizeLookupText(engineerName);
  if (!name) return null;

  return User.findOne({
    role: 'Installation Manager',
    isActive: true,
    $or: [
      { name: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      { email: name.toLowerCase() },
      { phone: normalizeMobile(name) },
    ],
  }).sort({ createdAt: 1 });
};

exports.createDispatch = async (req, res) => {
  const decremented = [];
  let dispatch = null;

  try {
    const { customerName, leadId, engineerName, siteAddress, dispatchDate } = req.body;
    const billNo = String(req.body.billNo || '').trim() || `DSP-${Date.now()}`;
    const requestedStatus = BILL_STATUSES.includes(req.body.approvalStatus) ? req.body.approvalStatus : 'Pending';
    const shouldReserveStock = requestedStatus === 'Pending';
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

    if (items.some(item => !item.productId || Number(item.quantity || 0) <= 0)) {
      return res.status(400).json({ success: false, message: 'Every selected material needs a valid quantity.' });
    }
    const normalizedItems = normalizeDispatchItems(items);

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

    const productIds = normalizedItems.map(item => item.productId);
    const productMap = new Map((await Product.find({ _id: { $in: productIds } })).map(product => [product._id.toString(), product]));
    if (productMap.size !== productIds.length) {
      return res.status(404).json({ success: false, message: 'Selected stock item not found.' });
    }

    const snapshots = [];
    for (const item of normalizedItems) {
      const existingProduct = productMap.get(item.productId);
      let product = existingProduct;

      if (shouldReserveStock) {
        product = await Product.findOneAndUpdate(
          { _id: item.productId, quantity: { $gte: item.quantity } },
          { $inc: { quantity: -item.quantity }, $set: { updatedBy: req.user._id } },
          { new: false }
        );

        if (!product) {
          await rollbackStock(decremented);
          return res.status(400).json({ success: false, message: 'Insufficient Stock' });
        }

        decremented.push(item);
      }

      const price = Number(item.price || product.salePrice || product.price || 0);
      const gstPercent = Number(item.gstPercent || product.gstPercent || 0);
      const line = calculateLine({ quantity: item.quantity, price, discountPercent: item.discountPercent, gstPercent });
      snapshots.push({
        productId: product._id,
        productName: product.name,
        productCode: product.productCode || product.sku || product._id.toString().slice(-6).toUpperCase(),
        sku: product.sku || product.productCode || '',
        hsnCode: product.hsnCode || '',
        category: product.category,
        brand: product.brand,
        type: product.type,
        capacity: product.capacity,
        unit: product.unit,
        quantity: item.quantity,
        price,
        discountPercent: Number(item.discountPercent || 0),
        gstPercent,
        ...line,
        remainingQuantity: shouldReserveStock ? Math.max(Number(product.quantity || 0) - item.quantity, 0) : Number(product.quantity || 0),
      });
    }

    const totals = calculateTotals(snapshots);

    const installationAssignee = await findInstallationAssignee(engineerName);

    dispatch = await Dispatch.create({
      billNo,
      invoiceType: req.body.invoiceType || 'Sales Invoice',
      customerName,
      customerGst: req.body.customerGst || '',
      customerEmail: req.body.customerEmail || '',
      leadId: lead?._id?.toString() || leadId || '',
      engineerName,
      salesPersonName: req.body.salesPersonName || req.user.name,
      siteAddress,
      mobile,
      paymentMode: req.body.paymentMode || 'Credit',
      dispatchStatus: req.body.dispatchStatus || 'Not Packed',
      narration: req.body.narration || '',
      dispatchDate: dispatchDate || new Date(),
      items: snapshots,
      ...totals,
      approvalStatus: requestedStatus,
      stockReserved: shouldReserveStock,
      billLocked: false,
      installationStatus: 'Pending',
      installationAssignee: installationAssignee?._id || null,
      installationAssigneeName: installationAssignee?.name || engineerName,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    await InventoryActivity.create({
      action: requestedStatus === 'Draft' ? 'Invoice Drafted' : requestedStatus === 'Hold' ? 'Invoice Held' : 'Stock Dispatched',
      dispatch: dispatch._id,
      message: `Bill ${billNo}: ${snapshots.length} materials ${shouldReserveStock ? 'dispatched to' : 'saved for'} ${customerName}`,
      quantityChange: shouldReserveStock ? -snapshots.reduce((sum, item) => sum + item.quantity, 0) : 0,
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

exports.updateDispatch = async (req, res) => {
  const stockDeltas = [];

  try {
    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) return res.status(404).json({ success: false, message: 'Dispatch not found' });
    if (dispatch.approvalStatus === 'Approved' || dispatch.billLocked) {
      return res.status(400).json({ success: false, message: 'Approved or locked bills cannot be edited.' });
    }

    const billNo = req.body.billNo !== undefined ? String(req.body.billNo || '').trim() : dispatch.billNo;
    const customerName = req.body.customerName !== undefined ? String(req.body.customerName || '').trim() : dispatch.customerName;
    const leadId = req.body.leadId !== undefined ? String(req.body.leadId || '').trim() : dispatch.leadId;
    const engineerName = req.body.engineerName !== undefined ? String(req.body.engineerName || '').trim() : dispatch.engineerName;
    const siteAddress = req.body.siteAddress !== undefined ? String(req.body.siteAddress || '').trim() : dispatch.siteAddress;
    const mobile = req.body.mobile !== undefined ? normalizeMobile(req.body.mobile) : dispatch.mobile;
    const dispatchDate = req.body.dispatchDate !== undefined ? req.body.dispatchDate : dispatch.dispatchDate;
    const requestedStatus = BILL_STATUSES.includes(req.body.approvalStatus) ? req.body.approvalStatus : dispatch.approvalStatus;
    const shouldReserveStock = requestedStatus === 'Pending';
    const rawItems = req.body.items === undefined
      ? dispatch.items.map(item => ({ productId: item.productId, quantity: item.quantity }))
      : req.body.items;

    if (!customerName || !engineerName || !siteAddress || !mobile) {
      return res.status(400).json({ success: false, message: 'Customer, engineer, site address and mobile are required.' });
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number.' });
    }
    if (!Array.isArray(rawItems) || !rawItems.length) {
      return res.status(400).json({ success: false, message: 'Select at least one material.' });
    }
    if (rawItems.some(item => !item.productId || Number(item.quantity || 0) <= 0)) {
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
      return res.status(400).json({ success: false, message: `Lead is at '${lead.currentStage}' stage. Dispatch can be edited only while lead is at 'Dispatch' stage.` });
    }

    const normalizedItems = normalizeDispatchItems(rawItems);
    const productIds = normalizedItems.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(404).json({ success: false, message: 'Selected stock item not found.' });
    }

    const currentQuantities = new Map();
    if (dispatch.stockReserved) dispatch.items.forEach((item) => {
      const productId = item.productId.toString();
      currentQuantities.set(productId, (currentQuantities.get(productId) || 0) + Number(item.quantity || 0));
    });

    const nextQuantities = shouldReserveStock
      ? new Map(normalizedItems.map(item => [item.productId, item.quantity]))
      : new Map();
    const allProductIds = Array.from(new Set([...currentQuantities.keys(), ...nextQuantities.keys()]));
    const quantityDeltas = allProductIds
      .map(productId => ({
        productId,
        delta: Number(nextQuantities.get(productId) || 0) - Number(currentQuantities.get(productId) || 0),
      }))
      .filter(item => item.delta !== 0);

    if (shouldReserveStock) {
      for (const item of quantityDeltas.filter(deltaItem => deltaItem.delta > 0)) {
        const product = await Product.findOneAndUpdate(
          { _id: item.productId, quantity: { $gte: item.delta } },
          { $inc: { quantity: -item.delta }, $set: { updatedBy: req.user._id } },
          { new: true }
        );
        if (!product) {
          await rollbackStockDeltas(stockDeltas);
          return res.status(400).json({ success: false, message: 'Insufficient Stock' });
        }
        stockDeltas.push(item);
      }
    }

    for (const item of quantityDeltas.filter(deltaItem => deltaItem.delta < 0)) {
      const product = await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: -item.delta }, $set: { updatedBy: req.user._id } },
        { new: true }
      );
      if (!product) throw new Error('Selected stock item not found.');
      stockDeltas.push(item);
    }

    const updatedProducts = await Product.find({ _id: { $in: productIds } });
    const snapshots = buildDispatchSnapshots(updatedProducts, normalizedItems);
    const totals = calculateTotals(snapshots);

    const installationAssignee = await findInstallationAssignee(engineerName);

    dispatch.billNo = billNo || dispatch.billNo || `DSP-${Date.now()}`;
    dispatch.customerName = customerName;
    dispatch.leadId = lead?._id?.toString() || leadId || '';
    dispatch.engineerName = engineerName;
    dispatch.invoiceType = req.body.invoiceType || dispatch.invoiceType || 'Sales Invoice';
    dispatch.customerGst = req.body.customerGst !== undefined ? req.body.customerGst : dispatch.customerGst;
    dispatch.customerEmail = req.body.customerEmail !== undefined ? req.body.customerEmail : dispatch.customerEmail;
    dispatch.salesPersonName = req.body.salesPersonName !== undefined ? req.body.salesPersonName : dispatch.salesPersonName;
    dispatch.paymentMode = req.body.paymentMode || dispatch.paymentMode || 'Credit';
    dispatch.dispatchStatus = req.body.dispatchStatus || dispatch.dispatchStatus || 'Not Packed';
    dispatch.narration = req.body.narration !== undefined ? req.body.narration : dispatch.narration;
    dispatch.installationAssignee = installationAssignee?._id || null;
    dispatch.installationAssigneeName = installationAssignee?.name || engineerName;
    dispatch.siteAddress = siteAddress;
    dispatch.mobile = mobile;
    dispatch.dispatchDate = dispatchDate || dispatch.dispatchDate || new Date();
    dispatch.items = snapshots;
    dispatch.subTotal = totals.subTotal;
    dispatch.discountTotal = totals.discountTotal;
    dispatch.gstTotal = totals.gstTotal;
    dispatch.grandTotal = totals.grandTotal;
    dispatch.roundOff = totals.roundOff;
    dispatch.payableAmount = totals.payableAmount;
    dispatch.approvalStatus = requestedStatus;
    dispatch.stockReserved = shouldReserveStock;
    await dispatch.save();

    const netQuantityChange = stockDeltas.reduce((sum, item) => sum + Number(item.delta || 0), 0);
    await InventoryActivity.create({
      action: 'Dispatch Updated',
      dispatch: dispatch._id,
      message: `Pending bill ${dispatch.billNo} updated for ${dispatch.customerName}`,
      quantityChange: -netQuantityChange,
      performedBy: req.user._id,
      performedByName: req.user.name,
    }).catch(console.error);

    res.json({ success: true, message: 'Pending dispatch bill updated', data: dispatch });
  } catch (err) {
    await rollbackStockDeltas(stockDeltas);
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
    if (dispatch.approvalStatus !== 'Pending' || !dispatch.stockReserved) {
      return res.status(400).json({ success: false, message: 'Only saved pending bills can be approved. Convert draft or hold bills to pending first.' });
    }

    dispatch.approvalStatus = 'Approved';
    dispatch.billLocked = true;
    dispatch.approvedAt = new Date();
    dispatch.approvedBy = req.user._id;
    dispatch.approvedByName = req.user.name;
    await dispatch.save();

    await InventoryActivity.create({
      action: 'Invoice Approved',
      dispatch: dispatch._id,
      message: `Bill ${dispatch.billNo} approved and moved to installation`,
      quantityChange: 0,
      performedBy: req.user._id,
      performedByName: req.user.name,
    }).catch(console.error);

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

      const installationManager = dispatch.installationAssignee
        ? await User.findById(dispatch.installationAssignee)
        : await findInstallationAssignee(dispatch.engineerName) || await User.findOne({ role: 'Installation Manager', isActive: true }).sort({ createdAt: 1 });
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
    let q = {};
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

    if (req.user.role === 'Installation Manager') {
      const personFilter = {
        $or: [
          { installationAssignee: req.user._id },
          { engineerName: new RegExp(`^${escapeRegex(req.user.name)}$`, 'i') },
        ],
      };
      q = Object.keys(q).length ? { $and: [q, personFilter] } : personFilter;
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
