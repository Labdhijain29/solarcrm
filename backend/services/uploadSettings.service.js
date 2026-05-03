const Setting = require('../models/Setting');

const UPLOAD_SETTING_TYPES = [
  'STORAGE_PROVIDER',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_FOLDER',
];

const SECRET_SETTING_TYPES = new Set([
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
]);

const DEFAULT_DESCRIPTIONS = {
  STORAGE_PROVIDER: 'Storage provider used by backend uploads.',
  CLOUDINARY_CLOUD_NAME: 'Cloudinary cloud name for upload storage.',
  CLOUDINARY_API_KEY: 'Cloudinary API key for upload storage.',
  CLOUDINARY_API_SECRET: 'Cloudinary API secret for upload storage.',
  CLOUDINARY_FOLDER: 'Cloudinary root folder for stored files.',
};

const isUploadSettingType = (type) => UPLOAD_SETTING_TYPES.includes(type);

const getDbUploadSettings = async () => {
  try {
    const settings = await Setting.find({ type: { $in: UPLOAD_SETTING_TYPES } }).lean();
    return new Map(settings.map((setting) => [setting.type, setting]));
  } catch {
    return new Map();
  }
};

const getEffectiveUploadSettings = async () => {
  const dbSettings = await getDbUploadSettings();

  return UPLOAD_SETTING_TYPES.reduce((acc, type) => {
    const dbValue = String(dbSettings.get(type)?.description || '').trim();
    const envValue = String(process.env[type] || '').trim();
    acc[type] = dbValue || envValue;
    return acc;
  }, {});
};

const getEffectiveUploadSetting = async (type) => {
  const settings = await getEffectiveUploadSettings();
  return settings[type] || '';
};

const maskSettingValue = (value) => {
  if (!value) return '';
  return '********configured';
};

const serializeUploadSetting = (type, setting, effectiveValue) => {
  const isSecret = SECRET_SETTING_TYPES.has(type);
  const value = String(setting?.description || effectiveValue || '').trim();

  return {
    _id: setting?._id || null,
    type,
    description: isSecret ? maskSettingValue(value) : value,
    isSecret,
    isConfigured: Boolean(value),
    helpText: DEFAULT_DESCRIPTIONS[type],
  };
};

const getUploadSettingsForResponse = async () => {
  const dbSettings = await getDbUploadSettings();
  const effectiveSettings = await getEffectiveUploadSettings();

  return UPLOAD_SETTING_TYPES.map((type) => (
    serializeUploadSetting(type, dbSettings.get(type), effectiveSettings[type])
  ));
};

const upsertUploadSettings = async (updates = {}) => {
  const updateEntries = Object.entries(updates)
    .filter(([type]) => isUploadSettingType(type))
    .map(([type, value]) => [type, String(value || '').trim()]);

  for (const [type, value] of updateEntries) {
    if (!value && SECRET_SETTING_TYPES.has(type)) continue;
    if (SECRET_SETTING_TYPES.has(type) && value.startsWith('********')) continue;

    await Setting.findOneAndUpdate(
      { type },
      { type, description: value },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  return getUploadSettingsForResponse();
};

module.exports = {
  UPLOAD_SETTING_TYPES,
  SECRET_SETTING_TYPES,
  getEffectiveUploadSettings,
  getEffectiveUploadSetting,
  getUploadSettingsForResponse,
  isUploadSettingType,
  upsertUploadSettings,
};
