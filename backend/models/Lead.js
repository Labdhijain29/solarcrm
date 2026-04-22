const mongoose = require('mongoose');

const STAGES = [
  'Lead', 'Registration', 'Bank Approval', 'Loan Disbursement',
  'Dispatch', 'Installation', 'Net Metering', 'Subsidy', 'Completed'
];

const historySchema = new mongoose.Schema({
  stage: { type: String, enum: STAGES },
  action: { type: String, enum: ['Created', 'In Progress', 'Approved', 'Rejected', 'Updated', 'Note Added', 'Completed'] },
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
    approvedAt: Date
  },
  bankData: {
    bankName: String,
    loanAmount: Number,
    approvedAt: Date
  },
  loanData: {
    disbursedAmount: Number,
    disbursedAt: Date
  },
  dispatchData: {
    panels: Number,
    inverter: String,
    trackingId: String,
    dispatchedAt: Date
  },
  installationData: {
    installedBy: String,
    installedAt: Date,
    systemSize: String
  },
  netMeteringData: {
    meterNumber: String,
    applicationDate: Date,
    approvedAt: Date
  },
  subsidyData: {
    subsidyAmount: Number,
    applicationRef: String,
    receivedAt: Date
  },

  // ─── Priority & Tags ─────────────────────────────────────────
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  tags: [String],

}, { timestamps: true });

// Index for common queries
leadSchema.index({ currentStage: 1, status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });
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
