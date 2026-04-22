const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = [
  'Admin', 'Manager', 'Sales Manager', 'Registration Executive',
  'Bank/Finance Executive', 'Loan Officer', 'Dispatch Manager',
  'Installation Manager', 'Net Metering Officer', 'Subsidy Officer',
  'Service Manager'
];

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: {
    type: String, required: [true, 'Email is required'],
    unique: true, lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
  phone: { type: String, trim: true },
  alternateContact: { type: String, trim: true },
  permanentAddress: { type: String, trim: true },
  address: { type: String, trim: true },
  state: { type: String, trim: true },
  city: { type: String, trim: true },
  pincode: { type: String, trim: true },
  franchiseEnabled: { type: Boolean, default: false },
  franchiseName: { type: String, trim: true },
  franchiseState: { type: String, trim: true },
  franchiseCity: { type: String, trim: true },
  franchiseSubDistrict: { type: String, trim: true },
  jobTitle: { type: String, trim: true },
  resume: { type: String, trim: true },
  documents: { type: String, trim: true },
  dateOfJoining: { type: Date },
  role: { type: String, enum: ROLES, required: [true, 'Role is required'] },
  isActive: { type: Boolean, default: true },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastLogin: { type: Date },
  profileImage: { type: String, default: '' },
  notifications: [{
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get stage for this role
userSchema.virtual('stageAccess').get(function () {
  const map = {
    'Admin': null,
    'Manager': 'Lead',
    'Sales Manager': 'Lead',
    'Registration Executive': 'Registration',
    'Bank/Finance Executive': 'Bank Approval',
    'Loan Officer': 'Loan Disbursement',
    'Dispatch Manager': 'Dispatch',
    'Installation Manager': 'Installation',
    'Net Metering Officer': 'Net Metering',
    'Subsidy Officer': 'Subsidy',
    'Service Manager': null,
  };
  return map[this.role];
});

module.exports = mongoose.model('User', userSchema);
