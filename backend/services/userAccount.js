const { runGlobal, officeId } = require('./officeContext');
const User = require('../models/User');
const { uploadFileAsset } = require('./storage/fileAsset');

const uploadUserDocument = async (userId, file) => {
  await User.findByIdAndUpdate(userId, {
    documents: file.originalname, documentsUploadStatus: 'processing', documentsUploadError: '',
  });
  try {
    const asset = await uploadFileAsset(file, { folder: 'users/registrations' });
    await User.findByIdAndUpdate(userId, {
      documents: asset.fileUrl, documentsFile: asset,
      documentsUploadStatus: 'completed', documentsUploadError: '',
    });
    return asset;
  } catch (error) {
    await User.findByIdAndUpdate(userId, {
      documentsUploadStatus: 'failed', documentsUploadError: String(error.message || 'Document upload failed').slice(0, 500),
    }).catch(() => {});
    throw error;
  }
};

const queueUserDocumentUpload = (userId, file) => {
  if (!file) return;
  setImmediate(() => uploadUserDocument(userId, file).catch(error => console.error('User document upload failed:', error.message)));
};

const createUserAccount = async ({ body, file, approvedBy = null }) => {
  if (body.office && String(body.office) !== String(officeId())) throw Object.assign(new Error('Create the user in the selected office.'), { statusCode: 400 });
  const email = String(body.email || '').trim().toLowerCase();
  if (await runGlobal(() => User.exists({ email }))) {
    const error = new Error('Email already in use');
    error.statusCode = 400;
    throw error;
  }
  const fields = ['name', 'password', 'role', 'phone', 'alternateContact', 'permanentAddress',
    'address', 'state', 'city', 'pincode', 'jobTitle', 'resume'];
  const data = Object.fromEntries(fields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
  const franchiseEnabled = body.franchiseEnabled === true || body.franchiseEnabled === 'true';
  const user = await User.create({
    ...data, email, office: officeId(), franchiseEnabled,
    ...Object.fromEntries(['franchiseName', 'franchiseState', 'franchiseCity', 'franchiseSubDistrict']
      .map(key => [key, franchiseEnabled ? body[key] || '' : ''])),
    documents: file?.originalname || body.documents,
    documentsUploadStatus: file ? 'processing' : 'none',
    dateOfJoining: body.dateOfJoining || undefined,
    isActive: Boolean(approvedBy), approvalStatus: approvedBy ? 'approved' : 'pending',
    approvedAt: approvedBy ? new Date() : null, approvedBy,
  });
  queueUserDocumentUpload(user._id, file);
  return user;
};

module.exports = { createUserAccount, uploadUserDocument };
