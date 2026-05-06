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
  const storedFile = await storageService.upload(file, options);
  return createFileAsset(storedFile.uploadedFile || file, storedFile);
};

const getFileDisplayValue = (asset, legacyValue = '') => {
  if (asset?.fileUrl) return asset.fileUrl;
  return legacyValue || '';
};

const shouldUseSignedDownload = (asset) => (
  asset?.provider === 'cloudinary'
  && asset?.fileKey
  && asset?.resourceType === 'raw'
  && asset?.deliveryType === 'private'
  && /(?:application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/i.test(asset?.mimeType || '')
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
