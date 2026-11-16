const normalizeContactPhone = value => String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
module.exports = { normalizeContactPhone };
