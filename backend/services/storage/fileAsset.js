const storageService = require('./storageService');

const createFileAsset = (file, storedFile) => ({
  fileUrl: storedFile.url,
  fileKey: storedFile.key,
  provider: storedFile.provider || 'cloudinary',
  resourceType: storedFile.resourceType || '',
  originalName: file.originalname || '',
  mimeType: file.mimetype || '',
  size: file.size || 0,
});

const uploadFileAsset = async (file, options = {}) => {
  const storedFile = await storageService.upload(file, options);
  return createFileAsset(file, storedFile);
};

const getFileDisplayValue = (asset, legacyValue = '') => {
  if (asset?.fileUrl) return asset.fileUrl;
  return legacyValue || '';
};

module.exports = {
  createFileAsset,
  uploadFileAsset,
  getFileDisplayValue,
};
