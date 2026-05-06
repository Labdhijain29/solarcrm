const cloudinaryStorage = require('./cloudinaryStorage');
const { optimizeUploadFile } = require('./mediaOptimizer');
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

const upload = async (file, options = {}) => {
  const optimizedFile = await optimizeUploadFile(file, options.optimization);
  const storedFile = await (await getProvider()).upload(optimizedFile, options);

  return {
    ...storedFile,
    uploadedFile: optimizedFile,
    originalSize: file?.size || file?.buffer?.length || 0,
    optimizedSize: optimizedFile?.size || optimizedFile?.buffer?.length || 0,
  };
};
const destroy = async (key) => (await getProvider()).delete(key);
const getUrl = async (key, options) => (await getProvider()).getUrl(key, options);

module.exports = {
  upload,
  delete: destroy,
  getUrl,
};
