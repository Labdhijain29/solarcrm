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

const getUploadResourceType = (file, options = {}) => {
  if (options.resourceType) return options.resourceType;

  const mimeType = String(file?.mimetype || '').toLowerCase();
  const fileName = String(file?.originalname || '').toLowerCase();
  const isDocument = (
    mimeType === 'application/pdf'
    || mimeType === 'application/msword'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || /\.(pdf|doc|docx)$/.test(fileName)
  );

  if (isDocument) return 'raw';
  return 'auto';
};

const upload = async (file, options = {}) => {
  if (!file?.buffer) {
    const error = new Error('No file buffer found for upload.');
    error.statusCode = 400;
    throw error;
  }

  const folder = await buildFolder(options.folder);
  const resourceType = getUploadResourceType(file, options);
  const deliveryType = options.type || (resourceType === 'raw' ? 'private' : undefined);

  return new Promise((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      resource_type: resourceType,
      ...(deliveryType ? { type: deliveryType } : {}),
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
        deliveryType: result.type || deliveryType || 'upload',
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

const getUrl = async (key, options = {}) => {
  if (!key) return '';
  await getConfig();

  if (options.signedDownload) {
    const publicId = String(key);
    const extensionMatch = publicId.match(/\.([a-zA-Z0-9]+)$/);
    const format = extensionMatch?.[1] || options.format || '';
    const expiresAt = options.expiresAt || Math.floor(Date.now() / 1000) + 60 * 60;

    return cloudinary.utils.private_download_url(publicId, '', {
      resource_type: options.resourceType || 'raw',
      type: options.type || 'upload',
      expires_at: expiresAt,
      ...(!extensionMatch && format ? { format } : {}),
    });
  }

  return cloudinary.url(key, { secure: true });
};

module.exports = {
  upload,
  delete: destroy,
  getUrl,
};
