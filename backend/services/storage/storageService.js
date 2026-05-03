const cloudinaryStorage = require('./cloudinaryStorage');
const { getEffectiveUploadSetting } = require('../uploadSettings.service');

const providers = {
  cloudinary: cloudinaryStorage,
};

const getProvider = async () => {
  const providerName = String(await getEffectiveUploadSetting('STORAGE_PROVIDER') || 'cloudinary').trim().toLowerCase();
  const provider = providers[providerName];

  if (!provider) {
    const error = new Error(`Unsupported storage provider: ${providerName}`);
    error.statusCode = 500;
    throw error;
  }

  return provider;
};

const upload = async (file, options) => (await getProvider()).upload(file, options);
const destroy = async (key) => (await getProvider()).delete(key);
const getUrl = async (key) => (await getProvider()).getUrl(key);

module.exports = {
  upload,
  delete: destroy,
  getUrl,
};
