const mongoose = require('mongoose');

const STAGES = [
  'Lead', 'Registration', 'Bank Approval', 'Loan Disbursement',
  'Dispatch', 'Installation', 'Net Metering', 'Subsidy', 'Subsidy Reading', 'Completed'
];

const fileAssetSchema = new mongoose.Schema({
  fileUrl: { type: String, trim: true, default: '' },
  fileKey: { type: String, trim: true, default: '' },
  provider: { type: String, trim: true, default: '' },
  resourceType: { type: String, trim: true, default: '' },
  originalName: { type: String, trim: true, default: '' },
  mimeType: { type: String, trim: true, default: '' },
  size: { type: Number, default: 0 },
}, { _id: false });

const historySchema = new mongoose.Schema({
  stage: { type: String, enum: STAGES },
  action: { type: String, enum: ['Created', 'In Progress', 'Approved', 'Rejected', 'Updated', 'Note Added', 'Completed', 'Transferred'] },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: String,
  note: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const leadSchema = new mongoose.Schema({
  // ─── Customer Info ──────────────────────────────────────────
  name: { type: String, required: [true, 'Customer name is required'], trim: true },
  phone: { type: String, required: [true, 'Phone is required'], trim: true },
  email: { type: String, lowercase: true, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  pincode: { type: String, trim: true, default: '' },
  branch: { type: String, trim: true, default: '' },
  ivrsNo: { type: String, trim: true, default: '' },

  // ─── Lead Info ───────────────────────────────────────────────
  source: {
    type: String,
    enum: ['Website', 'Social Media', 'Referral', 'Cold Call', 'Exhibition', 'Google Ads', 'Other'],
    default: 'Website'
  },
  generatedThrough: { type: String, trim: true, default: '' },
  capacity: { type: String, default: '3kW' }, // e.g. 3kW, 5kW
  roofType: { type: String, enum: ['Concrete', 'Metal Sheet', 'RCC', 'Tin', 'Other'], default: 'Concrete' },
  monthlyBill: { type: Number, default: 0 }, // Monthly electricity bill in INR
  notes: { type: String, default: '' },
  salesExecutiveData: {
    contact: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    addressdu: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
    panCardNo: { type: String, trim: true, default: '' },
    aadharNo: { type: String, trim: true, default: '' },
    dealNo: { type: String, trim: true, default: '' },
    brand: { type: String, trim: true, default: '' },
    monthlyUnit: { type: String, trim: true, default: '' },
    accountNo: { type: String, trim: true, default: '' },
    ifscCode: { type: String, trim: true, default: '' },
    other: { type: String, trim: true, default: '' },
    photoOneName: { type: String, trim: true, default: '' },
    photoTwoName: { type: String, trim: true, default: '' },
    documentPdfName: { type: String, trim: true, default: '' },
    aadharCardName: { type: String, trim: true, default: '' },
    panCardName: { type: String, trim: true, default: '' },
    bankStatementName: { type: String, trim: true, default: '' },
    photoOneFile: fileAssetSchema,
    photoTwoFile: fileAssetSchema,
    documentPdfFile: fileAssetSchema,
    aadharCardFile: fileAssetSchema,
    panCardFile: fileAssetSchema,
    bankStatementFile: fileAssetSchema
  },

  // ─── Assignment & Stage ──────────────────────────────────────
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ─── Workflow ─────────────────────────────────────────────────
  currentStage: { type: String, enum: STAGES, default: 'Lead' },
  status: {
    type: String,
    enum: ['active', 'completed', 'rejected', 'on-hold'],
    default: 'active'
  },
  history: [historySchema],

  // ─── Stage-specific Data ──────────────────────────────────────
  registrationData: {
    regNumber: String,
    documents: [String],
    documentFiles: [fileAssetSchema],
    approvedAt: Date
  },
  bankData: {
    bankName: String,
    loanAmount: Number,
    remark: String,
    approvedAt: Date
  },
  loanData: {
    applicationId: String,
    disbursedAmount: Number,
    disbursedAt: Date
  },
  dispatchData: {
    panels: Number,
    inverter: String,
    trackingId: String,
    billNo: String,
    items: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      productName: String,
      category: String,
      brand: String,
      type: String,
      capacity: String,
      unit: String,
      quantity: Number,
      remainingQuantity: Number
    }],
    dispatchedAt: Date
  },
  installationData: {
    installedBy: String,
    installedAt: Date,
    systemSize: String,
    panelPhotoName: { type: String, trim: true, default: '' },
    inverterBoxPhotoName: { type: String, trim: true, default: '' },
    earthingPhotoName: { type: String, trim: true, default: '' },
    columnConcretePhotoName: { type: String, trim: true, default: '' },
    panelPhotoFile: fileAssetSchema,
    inverterBoxPhotoFile: fileAssetSchema,
    earthingPhotoFile: fileAssetSchema,
    columnConcretePhotoFile: fileAssetSchema,
    panelNumber: { type: String, trim: true, default: '' },
    inverterNumber: { type: String, trim: true, default: '' },
    brand: { type: String, trim: true, default: '' },
    customerShortVideoName: { type: String, trim: true, default: '' },
    customerShortVideoFile: fileAssetSchema,
    completedAt: Date
  },
  netMeteringData: {
    meterNumber: { type: String, trim: true, default: '' },
    pdfName: { type: String, trim: true, default: '' },
    pdfFile: fileAssetSchema,
    applicationDate: Date,
    approvedAt: Date
  },
  subsidyData: {
    subsidyAmount: Number,
    applicationRef: String,
    photoName: { type: String, trim: true, default: '' },
    photoTwoName: { type: String, trim: true, default: '' },
    photoFile: fileAssetSchema,
    photoTwoFile: fileAssetSchema,
    receivedAt: Date
  },
  subsidyReadingData: {
    photoName: { type: String, trim: true, default: '' },
    photoFile: fileAssetSchema,
    completedAt: Date
  },

  // ─── Priority & Tags ─────────────────────────────────────────
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  tags: [String],

}, { timestamps: true });

// Index for common queries
leadSchema.index({ currentStage: 1, status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index(
  { ivrsNo: 1 },
  {
    unique: true,
    partialFilterExpression: { ivrsNo: { $type: 'string', $ne: '' } }
  }
);
leadSchema.index(
  { 'loanData.applicationId': 1 },
  {
    unique: true,
    partialFilterExpression: { 'loanData.applicationId': { $type: 'string', $ne: '' } }
  }
);
leadSchema.index(
  { 'installationData.inverterNumber': 1 },
  {
    unique: true,
    partialFilterExpression: { 'installationData.inverterNumber': { $type: 'string', $ne: '' } }
  }
);
leadSchema.index(
  { 'netMeteringData.meterNumber': 1 },
  {
    unique: true,
    partialFilterExpression: { 'netMeteringData.meterNumber': { $type: 'string', $ne: '' } }
  }
);
leadSchema.index({ name: 'text', phone: 'text', city: 'text' });

// Virtual: stage index
leadSchema.virtual('stageIndex').get(function () {
  return STAGES.indexOf(this.currentStage);
});

// Method: move to next stage
leadSchema.methods.approveStage = function (userId, userName, note) {
  const currentIdx = STAGES.indexOf(this.currentStage);
  if (currentIdx === -1 || currentIdx >= STAGES.length - 1) {
    throw new Error('Cannot advance beyond final stage');
  }

  // Update current stage history entry
  const lastHistory = this.history[this.history.length - 1];
  if (lastHistory && lastHistory.stage === this.currentStage) {
    lastHistory.action = 'Approved';
    lastHistory.performedBy = userId;
    lastHistory.performedByName = userName;
    lastHistory.note = note || 'Approved';
    lastHistory.timestamp = new Date();
  }

  // Move to next stage
  const nextStage = STAGES[currentIdx + 1];
  this.currentStage = nextStage;

  if (nextStage === 'Completed') {
    this.status = 'completed';
  }

  this.history.push({
    stage: nextStage,
    action: nextStage === 'Completed' ? 'Completed' : 'In Progress',
    performedBy: userId,
    performedByName: userName,
    note: `Moved to ${nextStage} stage`,
    timestamp: new Date()
  });

  return this;
};

// Method: reject stage
leadSchema.methods.rejectStage = function (userId, userName, note) {
  this.status = 'rejected';
  const lastHistory = this.history[this.history.length - 1];
  if (lastHistory) {
    lastHistory.action = 'Rejected';
    lastHistory.performedBy = userId;
    lastHistory.performedByName = userName;
    lastHistory.note = note || 'Rejected at this stage';
    lastHistory.timestamp = new Date();
  }
  return this;
};

module.exports = mongoose.model('Lead', leadSchema);
module.exports.STAGES = STAGES;
