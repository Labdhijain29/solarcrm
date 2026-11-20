const storageService = require('./storageService');

const createFileAsset = (file, storedFile) => ({
  fileUrl: storedFile.url,
  fileKey: storedFile.key,
  provider: storedFile.provider || 'cloudinary',
  resourceType: storedFile.resourceType || '',
  deliveryType: storedFile.deliveryType || '',
  originalName: file.originalname || '',
  mimeType: file.mimetype || '',
  size: file.size || 0,
});

const uploadFileAsset = async (file, options = {}) => {
  const office = require('../officeContext').officeId();
  const scopedOptions = office ? { ...options, type:'private', folder: `offices/${office}/${options.folder || 'files'}` } : options;
  const storedFile = await storageService.upload(file, scopedOptions);
  return createFileAsset(storedFile.uploadedFile || file, storedFile);
};

const getFileDisplayValue = (asset, legacyValue = '') => {
  if (asset?.fileUrl) return asset.fileUrl;
  return legacyValue || '';
};

const shouldUseSignedDownload = (asset) => (
  asset?.provider === 'cloudinary'
  && asset?.fileKey
  && asset?.deliveryType === 'private'
);

const withFreshFileUrl = async (asset) => {
  if (!asset) return asset;
  const plainAsset = typeof asset.toObject === 'function' ? asset.toObject() : { ...asset };

  if (!shouldUseSignedDownload(plainAsset)) return plainAsset;

  return {
    ...plainAsset,
    fileUrl: await storageService.getUrl(plainAsset.fileKey, {
      signedDownload: true,
      resourceType: plainAsset.resourceType,
      type: plainAsset.deliveryType,
      format: plainAsset.resourceType === 'raw' ? '' : String(plainAsset.originalName || '').split('.').pop(),
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
    }),
  };
};

module.exports = {
  createFileAsset,
  uploadFileAsset,
  getFileDisplayValue,
  withFreshFileUrl,
};
