const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');
const storage = new AsyncLocalStorage();
const fail = (message, statusCode = 403) => Object.assign(new Error(message), { statusCode });
const runGlobal = callback => storage.run({ global: true }, async () => await callback());
const runOffice = (office, callback) => storage.run({ office: new mongoose.Types.ObjectId(String(office)) }, async () => await callback());
const officeId = () => storage.getStore()?.office;
const context = () => {
  const current = storage.getStore();
  if (!current?.global && !current?.office) throw fail('An office must be selected.');
  return current;
};
module.exports = { storage, runGlobal, runOffice, officeId, context, fail };
