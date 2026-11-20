const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Office = require('../models/Office');
const { runGlobal } = require('../services/officeContext');

// Browser images/downloads cannot send an Authorization header. Short-lived
// capabilities are issued only in already-authorized JSON record responses.
function signLocalFiles(req, res, next) {
  const json = res.json.bind(res);
  res.json = value => {
    if (!req.user || !req.office) return json(value);
    const visit = async item => {
      if (typeof item === 'string' && /^\/?uploads\//.test(item)) {
        const file = `/${item.replace(/^\//, '').split('?')[0]}`;
        const registered = await Office.db.collection('officefiles').findOne({ _id:file });
        if (!registered || (req.user.role !== 'Admin' && String(registered.office) !== String(req.office._id))) return '';
        const token = jwt.sign({ purpose:'office-file', user:String(req.user._id), office:String(registered.office), file }, process.env.JWT_SECRET, { expiresIn:'10m' });
        return `${file}?access=${token}`;
      }
      if (Array.isArray(item)) return Promise.all(item.map(visit));
      if (item && typeof item === 'object') {
        if (item.fileKey && item.provider === 'cloudinary' && item.deliveryType === 'private') return require('../services/storage/fileAsset').withFreshFileUrl(item);
        return Object.fromEntries(await Promise.all(Object.entries(item).map(async ([key, child]) => [key, await visit(child)])));
      }
      return item;
    };
    // Serialize Dates/ObjectIds/Mongoose documents before traversing them.
    return visit(JSON.parse(JSON.stringify(value))).then(json).catch(next);
  };
  next();
}

async function protectLocalFile(req, res, next) {
  try {
    const payload = jwt.verify(req.query.access, process.env.JWT_SECRET);
    const file = decodeURIComponent(req.originalUrl.split('?')[0]);
    if (payload.purpose !== 'office-file' || payload.file !== file || file.includes('..') || file.includes('\\')) throw new Error('Invalid file link');
    const registered = await Office.db.collection('officefiles').findOne({ _id:file });
    if (!registered || String(registered.office) !== payload.office) throw new Error('Unknown file');
    const user = await runGlobal(() => User.findById(payload.user));
    if (!user?.isActive || (user.role !== 'Admin' && String(user.office) !== payload.office)) throw new Error('Access denied');
    const office = await Office.findById(payload.office);
    if (!office || (!office.isActive && user.role !== 'Admin')) throw new Error('Office unavailable');
    res.set('Cache-Control','private, no-store');
    next();
  } catch { res.status(403).json({ success:false, message:'This file link is invalid or expired. Reopen the record to get a new link.' }); }
}
module.exports = { signLocalFiles, protectLocalFile };
