const path = require('path');
const multer = require('multer');

const storage = multer.memoryStorage();

const documentExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx']);
const leadExtensions = new Set([
  ...documentExtensions,
  '.webp', '.mp4', '.mov', '.avi', '.mkv', '.webm',
]);

const createFileFilter = (allowedExtensions, message) => (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(ext)) {
    const error = new Error(message);
    error.statusCode = 400;
    return cb(error);
  }

  cb(null, true);
};

const uploadRegistrationDocument = multer({
  storage,
  fileFilter: createFileFilter(documentExtensions, 'Only PDF, JPG, PNG, DOC, and DOCX files are allowed.'),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('documents');

const leadFileFields = [
  { name: 'photoOne', maxCount: 1 },
  { name: 'photoTwo', maxCount: 1 },
  { name: 'documentPdf', maxCount: 1 },
  { name: 'aadharCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'bankStatement', maxCount: 1 },
  { name: 'panelPhoto', maxCount: 1 },
  { name: 'inverterBoxPhoto', maxCount: 1 },
  { name: 'earthingPhoto', maxCount: 1 },
  { name: 'columnConcretePhoto', maxCount: 1 },
  { name: 'customerShortVideo', maxCount: 1 },
  { name: 'netMeteringPdf', maxCount: 1 },
  { name: 'subsidyPhoto', maxCount: 1 },
  { name: 'subsidyPhotoTwo', maxCount: 1 },
  { name: 'subsidyReadingPhoto', maxCount: 1 },
];

const uploadLeadFiles = multer({
  storage,
  fileFilter: createFileFilter(leadExtensions, 'Only PDF, JPG, PNG, WEBP, DOC, DOCX, and common video files are allowed.'),
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields(leadFileFields);

const parseJsonField = (body, field) => {
  if (typeof body[field] !== 'string') return;
  const value = body[field].trim();
  if (!value) return;

  try {
    body[field] = JSON.parse(value);
  } catch {
    const error = new Error(`${field} must be valid JSON when sent as multipart/form-data.`);
    error.statusCode = 400;
    throw error;
  }
};

const parseTagsField = (body) => {
  if (typeof body.tags !== 'string') return;
  const value = body.tags.trim();
  if (!value) return;

  try {
    const parsed = JSON.parse(value);
    body.tags = Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
  } catch {
    body.tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
};

const normalizeMultipartBody = (req, _res, next) => {
  try {
    parseJsonField(req.body, 'stageData');
    parseJsonField(req.body, 'salesExecutiveData');
    parseJsonField(req.body, 'installationData');
    parseJsonField(req.body, 'netMeteringData');
    parseJsonField(req.body, 'subsidyData');
    parseJsonField(req.body, 'subsidyReadingData');
    parseTagsField(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadRegistrationDocument, uploadLeadFiles, normalizeMultipartBody };
