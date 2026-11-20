const Office = require('../models/Office');
const { runGlobal, runOffice, fail } = require('../services/officeContext');
const mongoose = require('mongoose');

async function resolveOffice(req) {
  const own = req.user?.office;
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  const identityRequest = ['/api/auth/me','/api/auth/logout','/api/auth/change-password','/api/users/me'].includes(path) || (req.method === 'GET' && path === '/api/offices');
  const selected = !identityRequest && req.user?.role === 'Admin' ? req.get('X-Office-Id') || own : own;
  if (!identityRequest && req.user?.role !== 'Admin' && req.get('X-Office-Id') && String(req.get('X-Office-Id')) !== String(own)) throw fail('You cannot switch offices.');
  if (!mongoose.isValidObjectId(selected)) throw fail('Select a valid office.', 400);
  const office = await Office.findById(selected);
  if (!office) throw fail('Office not found.', 404);
  req.office = office;
  const ownAccount = /^\/api\/(auth\/|users\/(me|notifications)(\/|$))/.test(req.originalUrl);
  const officeManagement = /^\/api\/offices(\/|$)/.test(req.originalUrl);
  if (!office.isActive && req.user.role !== 'Admin' && !ownAccount) throw fail('Your office is inactive. Please contact Admin.');
  if (!office.isActive && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !ownAccount && !officeManagement) throw fail('This office is inactive. New work and changes are disabled.');
  return office;
}

async function publicOffice(req, res, next) {
  if (req.user) return next();
  try {
    if (!mongoose.isValidObjectId(req.body.office)) throw fail('Please select an office.', 400);
    const office = await Office.findOne({ _id: req.body.office, isActive: true });
    if (!office) throw fail('Select an active office.', 400);
    req.office = office;
    runOffice(office._id, next);
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
}

const globalHandler = handler => (req, res, next) => runGlobal(() => handler(req, res, next));
module.exports = { resolveOffice, publicOffice, globalHandler };
