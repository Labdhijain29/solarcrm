const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { validateLead, validateEnquiry, validateLeadUpdate, validateEnquiryUpdate } = require('../middleware/validate.middleware');
let server, url;
before(async () => {
  const app = express();
  app.use(express.json());
  for (const [route, rules] of Object.entries({ lead: validateLead, enquiry: validateEnquiry, 'lead-edit': validateLeadUpdate, 'enquiry-edit': validateEnquiryUpdate })) {
    app.post('/' + route, rules, (req, res) => res.json(req.body));
  }
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
const submit = async (route, body) => {
  const response = await fetch(`${url}/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
};
const valid = route => route === 'lead' ? { name: 'Customer', phone: '4567890123', branch: 'Test branch' }
  : { name: 'Customer', contact: '4567890123', enquiryType: 'Sales Enquiry' };

test('lead/enquiry create and edit accept ten digits starting with 4', async () => {
  for (const route of ['lead', 'enquiry', 'lead-edit', 'enquiry-edit']) {
    const result = await submit(route, valid(route.startsWith('lead') ? 'lead' : 'enquiry'));
    assert.equal(result.status, 200, JSON.stringify(result.body));
  }
});
test('country-code normalization supports numbers starting with 4 without stripping a ten-digit number starting with 91', async () => {
  for (const route of ['lead', 'enquiry', 'lead-edit', 'enquiry-edit']) {
    const key = route.startsWith('lead') ? 'phone' : 'contact';
    for (const [input, expected] of [['+91 45678 90123', '4567890123'], ['9123456789', '9123456789']]) {
      const result = await submit(route, { ...valid(route.startsWith('lead') ? 'lead' : 'enquiry'), [key]: input });
      assert.equal(result.status, 200);
      assert.equal(result.body[key], expected);
    }
  }
});
test('short and long numbers report the actual length error in creates and edits', async () => {
  for (const route of ['lead', 'enquiry', 'lead-edit', 'enquiry-edit']) {
    const key = route.startsWith('lead') ? 'phone' : 'contact';
    for (const phone of ['456789012', '45678901234']) {
      const result = await submit(route, { ...valid(route.startsWith('lead') ? 'lead' : 'enquiry'), [key]: phone });
      assert.equal(result.status, 422);
      assert.equal(result.body.message, 'Contact number must contain exactly 10 digits.');
      assert.equal(result.body.errors[0].field, key);
    }
  }
});
test('missing enquiry type reports the selection error, not a generic validation error', async () => {
  const result = await submit('enquiry', { ...valid('enquiry'), enquiryType: '' });
  assert.equal(result.status, 422);
  assert.equal(result.body.message, 'Please select an enquiry type.');
});
test('multiple validation failures identify every affected field', async () => {
  const result = await submit('enquiry', { ...valid('enquiry'), name: '  ', email: 'bad-email', pincode: '123', enquiryType: '' });
  assert.equal(result.status, 422);
  for (const error of result.body.errors) assert(result.body.message.includes(error.message));
  assert.deepEqual(result.body.errors.map(e => e.field).sort(), ['email', 'enquiryType', 'name', 'pincode']);
  assert(!result.body.message.includes('Validation failed'));
});
test('partial edits do not require omitted phone numbers', async () => {
  for (const route of ['lead-edit', 'enquiry-edit']) assert.equal((await submit(route, { notes: 'A note' })).status, 200);
});
test('invalid email and pincode report specific messages for both creates and edits', async () => {
  for (const route of ['lead', 'enquiry', 'lead-edit', 'enquiry-edit']) {
    const result = await submit(route, { ...valid(route.startsWith('lead') ? 'lead' : 'enquiry'), email: 'bad-email', pincode: '123' });
    assert.equal(result.status, 422);
    assert(result.body.message.includes('Enter a valid email address.'));
    assert(result.body.message.includes('Pincode must contain exactly 6 digits.'));
  }
});
test('frontend phone rules and error extraction agree with the API', async () => {
  const { CONTACT_PHONE_REGEX, normalizeContactPhone, validationMessage } = await import('../../frontend/src/utils/contactValidation.js');
  assert(CONTACT_PHONE_REGEX.test('4567890123'));
  assert(!CONTACT_PHONE_REGEX.test('456789012'));
  assert.equal(normalizeContactPhone('+91 45678 90123'), '4567890123');
  assert.equal(normalizeContactPhone('9123456789'), '9123456789');
  assert.equal(validationMessage({ message: 'Validation failed', errors: [{ message: 'Select a type.' }, { msg: 'Enter a valid email.' }, { message: 'Select a type.' }] }), 'Select a type.\nEnter a valid email.');
  assert.equal(validationMessage({ message: 'This IVRS number already exists.' }), '');
});
