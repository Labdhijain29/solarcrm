const fs = require('fs');
const path = require('path');
const multer = require('multer');

const registrationUploadDir = path.join(__dirname, '..', 'uploads', 'registrations');
fs.mkdirSync(registrationUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, registrationUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '-');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx']);
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(ext)) {
    const error = new Error('Only PDF, JPG, PNG, DOC, and DOCX files are allowed.');
    error.statusCode = 400;
    return cb(error);
  }

  cb(null, true);
};

const uploadRegistrationDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('documents');

module.exports = { uploadRegistrationDocument };
