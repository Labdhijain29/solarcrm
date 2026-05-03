const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true, default: '' },
}, {
  versionKey: false,
});

module.exports = mongoose.model('Setting', settingSchema);
