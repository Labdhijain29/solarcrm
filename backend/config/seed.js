require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Enquiry = require('../models/Enquiry');
const Product = require('../models/Product');
const Dispatch = require('../models/Dispatch');
const InventoryActivity = require('../models/InventoryActivity');

const STAGES = ['Lead','Registration','Bank Approval','Loan Disbursement','Dispatch','Installation','Net Metering','Subsidy','Subsidy Reading','Completed'];
const SOURCES = ['Website','Social Media','Referral','Cold Call','Exhibition','Google Ads'];
const CITIES = ['Mumbai','Delhi','Bangalore','Pune','Hyderabad','Chennai','Ahmedabad','Jaipur','Surat','Kolkata'];
const ENQUIRY_CATEGORIES = ['Residential', 'Commercial', 'Industrial', 'Agriculture'];

const usersData = [
  { name:'Arjun Sharma', email:'admin@solarcrm.in', password:'admin123', role:'Admin', phone:'9800000001' },
  { name:'Priya Verma', email:'manager@solarcrm.in', password:'manager123', role:'Manager', phone:'9800000002' },
  { name:'Rohit Patel', email:'sales@solarcrm.in', password:'sales123', role:'Sales Manager', phone:'9800000003' },
  { name:'Sneha Gupta', email:'reg@solarcrm.in', password:'reg123', role:'Registration Executive', phone:'9800000004' },
  { name:'Amit Kumar', email:'bank@solarcrm.in', password:'bank123', role:'Bank/Finance Executive', phone:'9800000005' },
  { name:'Kavya Singh', email:'loan@solarcrm.in', password:'loan123', role:'Loan Officer', phone:'9800000006' },
  { name:'Nikhil Store', email:'stock@solarcrm.in', password:'stock123', role:'Stock Manager', phone:'9800000012' },
  { name:'Rajan Mishra', email:'dispatch@solarcrm.in', password:'dispatch123', role:'Dispatch Manager', phone:'9800000007' },
  { name:'Meera Nair', email:'install@solarcrm.in', password:'install123', role:'Installation Manager', phone:'9800000008' },
  { name:'Suresh Rao', email:'netmeter@solarcrm.in', password:'netmeter123', role:'Net Metering Officer', phone:'9800000009' },
  { name:'Anita Joshi', email:'subsidy@solarcrm.in', password:'subsidy123', role:'Subsidy Officer', phone:'9800000010' },
  { name:'Ritu Reading', email:'subsidyreading@solarcrm.in', password:'reading123', role:'Subsidy Reading Officer', phone:'9800000013' },
  { name:'Vikram Service', email:'service@solarcrm.in', password:'service123', role:'Service Manager', phone:'9800000011' },
];

const productsData = [
  { name: 'Waaree 540WP DCR Module', category: 'MODULE', brand: 'Warree', type: 'DCR P-Type', capacity: '540WP', quantity: 120, price: 9800, unit: 'pcs', lowStockThreshold: 20 },
  { name: 'Adani 570WP TOPCon Module', category: 'MODULE', brand: 'Adani', type: 'N-Type TOPCon', capacity: '570WP', quantity: 80, price: 11200, unit: 'pcs', lowStockThreshold: 15 },
  { name: 'Sungrow 5kw On Grid Inverter', category: 'INVERTER (ON-GRID)', brand: 'Sungrow', type: 'Capacity', capacity: '5kw', quantity: 18, price: 52000, unit: 'pcs', lowStockThreshold: 5 },
  { name: 'Havells Single Phase AC/DC Box', category: 'AC/DC BOX', brand: 'Havells', type: 'Phase', capacity: 'Single Phase', quantity: 35, price: 4200, unit: 'pcs', lowStockThreshold: 8 },
  { name: 'JSW Structure 140*50*2mm 13 feet', category: 'STRUCTURE', brand: 'JSW', type: 'Size', capacity: '140*50*2mm | 13 feet', quantity: 200, price: 1450, unit: 'pcs', lowStockThreshold: 25 },
];

const firstNames = ['Rajesh','Neha','Vijay','Ananya','Sunil','Deepa','Arun','Pooja','Kiran','Mohan','Lakshmi','Prakash','Sunita','Ganesh','Rekha','Amit','Shweta','Vinod','Kavita','Mahesh'];
const lastNames = ['Kumar','Singh','Patel','Sharma','Verma','Gupta','Nair','Reddy','Joshi','Mehta'];
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
const rndName = () => `${rnd(firstNames)} ${rnd(lastNames)}`;

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/solarcrm');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Lead.deleteMany({});
    await Enquiry.deleteMany({});
    await Product.deleteMany({});
    await Dispatch.deleteMany({});
    await InventoryActivity.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const u of usersData) {
      const user = await User.create({ ...u, isActive: true });
      createdUsers.push(user);
    }
    console.log(`👥 Created ${createdUsers.length} users`);

    // Create leads
    const leads = [];
    for (let i = 0; i < 45; i++) {
      const stageIdx = Math.floor(Math.random() * STAGES.length);
      const stage = STAGES[stageIdx];
      const status = Math.random() > 0.08 ? 'active' : (Math.random() > 0.5 ? 'rejected' : 'completed');

      const history = STAGES.slice(0, stageIdx + 1).map((s, idx) => ({
        stage: s,
        action: idx === stageIdx && status === 'active' ? 'In Progress' : 'Approved',
        performedBy: createdUsers[Math.floor(Math.random() * createdUsers.length)]._id,
        performedByName: rnd(createdUsers).name,
        note: 'Documents verified and approved.',
        timestamp: new Date(Date.now() - (stageIdx - idx) * 5 * 24 * 3600 * 1000)
      }));

      leads.push({
        name: rndName(),
        phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
        email: `customer${i + 1}@example.com`,
        address: `${Math.floor(100 + Math.random() * 900)} ${rnd(['MG Road','Park Street','Lake View','Nehru Nagar','Gandhi Marg'])}, ${rnd(CITIES)}`,
        city: rnd(CITIES),
        state: rnd(['Maharashtra','Karnataka','Delhi','Rajasthan','Telangana']),
        pincode: `${Math.floor(100000 + Math.random() * 899999)}`,
        source: rnd(SOURCES),
        capacity: `${rnd([2,3,5,7,10])}kW`,
        roofType: rnd(['Concrete','Metal Sheet','RCC','Tin']),
        monthlyBill: rnd([2000,3000,5000,8000,12000,15000]),
        assignedTo: createdUsers[Math.floor(Math.random() * createdUsers.length)]._id,
        currentStage: stage,
        status,
        history,
        notes: 'Customer interested in on-grid solar system with net metering.',
        createdBy: createdUsers[0]._id,
      });
    }

    await Lead.insertMany(leads);
    console.log(`📋 Created ${leads.length} leads`);

    // Sample enquiries
    const enquiries = Array.from({ length: 12 }, (_, i) => ({
      name: rndName(),
      phone: `97${Math.floor(10000000 + Math.random() * 89999999)}`,
      email: `enquiry${i+1}@example.com`,
      city: rnd(CITIES),
      category: rnd(ENQUIRY_CATEGORIES),
      capacity: rnd(['2kW','3kW','5kW','7kW','10kW+']),
      message: 'I am interested in solar installation for my home. Please contact me.',
      status: rnd(['new','contacted','converted','closed']),
    }));
    await Enquiry.insertMany(enquiries);
    console.log(`📩 Created ${enquiries.length} enquiries`);

    const stockManager = createdUsers.find(user => user.role === 'Stock Manager') || createdUsers[0];
    await Product.insertMany(productsData.map(item => ({
      ...item,
      createdBy: stockManager._id,
      updatedBy: stockManager._id,
    })));
    console.log(`📦 Created ${productsData.length} stock items`);

    console.log('\n🎉 Seed complete! Login credentials:');
    usersData.forEach(u => console.log(`  ${u.role.padEnd(30)} ${u.email} / ${u.password}`));

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
