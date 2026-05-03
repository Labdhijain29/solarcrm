const {
  UPLOAD_SETTING_TYPES,
  getUploadSettingsForResponse,
  upsertUploadSettings,
} = require('../services/uploadSettings.service');

exports.getUploadSettings = async (_req, res) => {
  try {
    const settings = await getUploadSettingsForResponse();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUploadSettings = async (req, res) => {
  try {
    const payload = Array.isArray(req.body?.settings)
      ? Object.fromEntries(req.body.settings.map((item) => [item.type, item.description]))
      : req.body || {};

    const unknownTypes = Object.keys(payload).filter((type) => !UPLOAD_SETTING_TYPES.includes(type));
    if (unknownTypes.length) {
      return res.status(400).json({
        success: false,
        message: `Unsupported upload setting: ${unknownTypes.join(', ')}`,
      });
    }

    const settings = await upsertUploadSettings(payload);
    res.json({ success: true, message: 'Upload settings saved', data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
