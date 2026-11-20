const mongoose = require('mongoose');
const { context, officeId, fail } = require('./officeContext');

// Apply at the model boundary, so counts, populate, direct ID lookups and new
// controller queries follow the same rule. Raw collection access is reserved
// for migrations, global identity/IVRS checks and validated reference checks.
module.exports = function officeScope(schema) {
  schema.add({ office: { type: mongoose.Schema.Types.ObjectId, ref: 'Office', required: true, immutable: true, index: true, default: officeId } });
  const assertDocument = document => {
    const current = context();
    if (current.global) return;
    if (!document.office) document.office = current.office;
    if (String(document.office) !== String(current.office)) throw fail('This record belongs to another office.');
  };
  const assetKeys = value => {
    if (!value || typeof value !== 'object') return [];
    if (value.fileKey && typeof value.fileKey === 'string') return [value.fileKey];
    return Object.values(value).flatMap(assetKeys);
  };
  schema.post('init', document => { document.$locals.originalAssetKeys = new Set(assetKeys(document.toObject())); });
  async function validateReferences(model, value, office) {
    if (!value || !office) return;
    const refs = model.schema.paths;
    for (const [key, path] of Object.entries(refs)) {
      // Actor/history references may refer to a global Admin. Business ownership
      // links must always remain within the current office.
      if (!['assignedTo', 'salesExecutiveAssignee', 'sourceEnquiry', 'convertedTo', 'installationAssignee', 'product', 'dispatch'].includes(key)) continue;
      const id = value[key];
      if (!id || !path.options.ref) continue;
      const target = mongoose.model(path.options.ref);
      if (!await target.collection.findOne({ _id: new mongoose.Types.ObjectId(String(id?._id || id)), office }, { projection: { _id: 1 } })) throw fail('Select a record or executive from the current office.');
    }
    if (Array.isArray(value.items)) {
      for (const item of value.items) if (item.productId && !await mongoose.model('Product').collection.findOne({ _id: new mongoose.Types.ObjectId(String(item.productId)), office }, { projection: { _id: 1 } })) throw fail('A product belongs to another office.');
    }
    const nested = typeof value.get === 'function' ? key => value.get(key) : key => value[key] ?? key.split('.').reduce((item, part) => item?.[part], value);
    const executive = nested('salesExecutiveData.executiveId');
    if (executive && !await mongoose.model('User').collection.findOne({ _id: new mongoose.Types.ObjectId(String(executive)), office }, { projection: { _id: 1 } })) throw fail('Select an executive from the current office.');
    const items = nested('dispatchData.items');
    if (items) await validateReferences(model, { items }, office);
  }
  schema.pre('validate', function () { assertDocument(this); });
  schema.pre('save', async function () {
    assertDocument(this);
    if (!context().global) for (const key of assetKeys(this.toObject())) {
      const match = key.match(/(?:^|\/)offices\/([a-f\d]{24})\//i);
      if (match && match[1] !== String(this.office)) throw fail('This file belongs to another office.');
      if (!match && !this.$locals.originalAssetKeys?.has(key)) throw fail('Upload files through the form. Existing file links cannot be copied to another record.');
    }
    await validateReferences(this.constructor, this, this.office);
  });
  schema.pre('insertMany', async function (next, documents) {
    try { for (const doc of documents) { assertDocument(doc); await validateReferences(this, doc, doc.office); } next(); } catch (error) { next(error); }
  });
  schema.pre(/^(find|countDocuments|distinct|update|delete|replace)/, async function () {
    const current = context();
    if (current.global) return;
    this.setQuery({ $and: [this.getFilter(), { office: current.office }] });
    if (this.op.startsWith('replace')) throw fail('Replacing office records is not supported.');
    const update = this.getUpdate();
    if (update) {
      if (Array.isArray(update)) throw fail('Pipeline updates are not supported for office records.');
      for (const [operator, changes] of Object.entries(update)) {
        if (operator === 'office' || (operator.startsWith('$') && Object.keys(changes || {}).some(key => key === 'office' || key.startsWith('office.')))) throw fail('Moving records between offices is not allowed.');
      }
      await validateReferences(this.model, { ...update, ...update.$set, ...update.$setOnInsert }, current.office);
      if (this.getOptions().upsert) update.$setOnInsert = { ...update.$setOnInsert, office: current.office };
    }
  });
  schema.pre('estimatedDocumentCount', function () { throw fail('Use an office-scoped count.'); });
  schema.pre('aggregate', function () {
    const current = context();
    if (current.global) return;
    const stages = this.pipeline();
    const unsafe = pipeline => pipeline.some(stage => stage.$lookup || stage.$unionWith || stage.$graphLookup || stage.$out || stage.$merge || (stage.$facet && Object.values(stage.$facet).some(unsafe)));
    if (unsafe(stages)) throw fail('This aggregation requires an explicit office-safe implementation.');
    stages.unshift({ $match: { office: current.office } });
  });
  schema.pre('bulkWrite', function (next) { next(fail('Use office-scoped model operations instead of bulk writes.')); });
};
