require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const usersData = [
  { name: 'Arjun Sharma', email: 'admin@solarcrm.in', password: 'admin123', role: 'Admin', phone: '9800000001' },
  { name: 'Priya Verma', email: 'manager@solarcrm.in', password: 'manager123', role: 'Manager', phone: '9800000002' },
  { name: 'Rohit Patel', email: 'sales@solarcrm.in', password: 'sales123', role: 'Sales Manager', phone: '9800000003' },
  { name: 'Sneha Gupta', email: 'reg@solarcrm.in', password: 'reg123', role: 'Registration Executive', phone: '9800000004' },
  { name: 'Amit Kumar', email: 'bank@solarcrm.in', password: 'bank123', role: 'Bank/Finance Executive', phone: '9800000005' },
  { name: 'Kavya Singh', email: 'loan@solarcrm.in', password: 'loan123', role: 'Loan Officer', phone: '9800000006' },
  { name: 'Rajan Mishra', email: 'dispatch@solarcrm.in', password: 'dispatch123', role: 'Dispatch Manager', phone: '9800000007' },
  { name: 'Meera Nair', email: 'install@solarcrm.in', password: 'install123', role: 'Installation Manager', phone: '9800000008' },
  { name: 'Suresh Rao', email: 'netmeter@solarcrm.in', password: 'netmeter123', role: 'Net Metering Officer', phone: '9800000009' },
  { name: 'Anita Joshi', email: 'subsidy@solarcrm.in', password: 'subsidy123', role: 'Subsidy Officer', phone: '9800000010' },
];

async function resetDemoPasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/solarcrm');
    console.log('Connected to MongoDB');

    for (const data of usersData) {
      const user = await User.findOne({ email: data.email }).select('+password');
      if (user) {
        user.name = data.name;
        user.password = data.password;
        user.role = data.role;
        user.phone = data.phone;
        user.isActive = true;
        await user.save();
      } else {
        await User.create({ ...data, isActive: true });
      }
      console.log(`Ready: ${data.email} / ${data.password}`);
    }

    console.log('\nDemo login credentials have been reset.');
    process.exit(0);
  } catch (err) {
    console.error('Password reset error:', err);
    process.exit(1);
  }
}

resetDemoPasswords();
