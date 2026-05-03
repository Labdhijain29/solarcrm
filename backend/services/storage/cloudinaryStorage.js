const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;
const { getEffectiveUploadSettings } = require('../uploadSettings.service');

const REQUIRED_ENV = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_FOLDER',
];

const sanitizeFolderPart = (part) => String(part || '')
  .trim()
  .replace(/\\/g, '/')
  .split('/')
  .map((segment) => segment.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-'))
  .filter(Boolean)
  .join('/');

const getConfig = async () => {
  const settings = await getEffectiveUploadSettings();
  const missing = REQUIRED_ENV.filter((key) => !settings[key]);
  if (missing.length) {
    const error = new Error(`Cloudinary storage is not configured. Missing: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }

  cloudinary.config({
    cloud_name: settings.CLOUDINARY_CLOUD_NAME,
    api_key: settings.CLOUDINARY_API_KEY,
    api_secret: settings.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return {
    rootFolder: sanitizeFolderPart(settings.CLOUDINARY_FOLDER),
  };
};

const buildFolder = async (folder) => {
  const { rootFolder } = await getConfig();
  return [rootFolder, sanitizeFolderPart(process.env.NODE_ENV || 'development'), sanitizeFolderPart(folder)]
    .filter(Boolean)
    .join('/');
};

const upload = async (file, options = {}) => {
  if (!file?.buffer) {
    const error = new Error('No file buffer found for upload.');
    error.statusCode = 400;
    throw error;
  }

  const folder = await buildFolder(options.folder);

  return new Promise((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      resource_type: 'auto',
      folder,
      use_filename: true,
      unique_filename: true,
      filename_override: file.originalname,
    },
    (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        url: result.secure_url,
        key: result.public_id,
        provider: 'cloudinary',
        resourceType: result.resource_type,
      });
    }
  );

  Readable.from(file.buffer).pipe(uploadStream);
  });
};

const destroy = async (key) => {
  if (!key) return null;
  await getConfig();

  const attempts = await Promise.allSettled(
    ['image', 'video', 'raw'].map((resourceType) => (
      cloudinary.uploader.destroy(key, { resource_type: resourceType })
    ))
  );

  const fulfilled = attempts.find((attempt) => attempt.status === 'fulfilled' && attempt.value?.result === 'ok');
  return fulfilled?.value || null;
};

const getUrl = async (key) => {
  if (!key) return '';
  await getConfig();
  return cloudinary.url(key, { secure: true });
};

module.exports = {
  upload,
  delete: destroy,
  getUrl,
};
