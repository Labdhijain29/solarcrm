require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const [, , emailArg, passwordArg] = process.argv;

const email = String(emailArg || '').trim().toLowerCase();
const newPassword = String(passwordArg || '');

async function resetUserPassword() {
  if (!email || !newPassword) {
    console.error('Usage: npm run reset-user-password -- user@example.com NewPassword123');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/solarcrm');

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    user.password = newPassword;
    await user.save();

    console.log(`Password reset successfully for ${email}`);
    process.exit(0);
  } catch (err) {
    console.error('Password reset error:', err.message);
    process.exit(1);
  }
}

resetUserPassword();
