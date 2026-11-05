const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const bundle = async (entry, plugins = []) => {
  const result = await esbuild.build({ absWorkingDir: root, entryPoints: [entry], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', define: { 'import.meta.env': '{}' }, plugins });
  const compiled = new Module(path.join(root, 'account-test-bundle.cjs'), module);
  compiled.filename = path.join(root, 'account-test-bundle.cjs');
  compiled.paths = Module._nodeModulePaths(root);
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  return compiled.exports;
};
const form = () => ({ name: ' Test user ', email: ' NEWUSER@EXAMPLE.COM ', password: 'sample-password', role: 'Enquiry Executive',
  phone: '+91 9876543210', alternateContact: '', permanentAddress: 'Permanent address', address: 'Current address',
  state: 'Rajasthan', city: 'Jaipur', pincode: '302001', dateOfJoining: '2026-11-05', franchiseEnabled: true,
  franchiseName: 'Test franchise', franchiseState: 'Rajasthan', franchiseCity: 'Jaipur', franchiseSubDistrict: 'Jaipur North', documents: null });

test('shared form renders every registration field in public and Admin modes', async () => {
  const { default: AccountForm } = await bundle('src/components/common/UserAccountForm.jsx');
  const { todayAccountDate } = await bundle('src/utils/userAccount.js');
  for (const admin of [false, true]) {
    const markup = renderToStaticMarkup(React.createElement(AccountForm, { admin, onSubmit: async () => {} }));
    for (const label of ['Name', 'Contact', 'Alternate Contact', 'Email Address', 'Password', 'Role', 'Permanent Address',
      'Address', 'State', 'City', 'Pincode', 'Date of Joining', 'Franchise', 'Documents']) assert.ok(markup.includes(label), label);
    assert.ok(markup.includes(admin ? 'Create User' : 'Register'));
    assert.ok(markup.includes('type="file"'));
    assert.ok(markup.includes(`type="date" value="${todayAccountDate()}"`));
  }
});

test('shared payload includes all fields and optional document, normalizes identity and clears disabled franchise', async () => {
  const { buildAccountFormData } = await bundle('src/utils/userAccount.js');
  const input = form(); input.documents = new File(['document'], 'document.pdf', { type: 'application/pdf' });
  const publicData = buildAccountFormData(input);
  const adminData = buildAccountFormData(input, true);
  for (const [key, value] of publicData.entries()) assert.equal(adminData.get(key), value, key);
  assert.equal(adminData.get('email'), 'newuser@example.com');
  assert.equal(adminData.get('name'), 'Test user');
  assert.equal(adminData.get('phone'), '9876543210');
  assert.equal(adminData.get('franchiseEnabled'), 'true');
  assert.equal(adminData.get('franchiseSubDistrict'), 'Jaipur North');
  assert.equal(adminData.get('documents').name, 'document.pdf');
  assert.equal(publicData.has('documents'), false);
  const disabledData = buildAccountFormData({ ...input, franchiseEnabled: false });
  assert.equal(disabledData.get('franchiseEnabled'), 'false');
  for (const key of ['franchiseName', 'franchiseState', 'franchiseCity', 'franchiseSubDistrict']) assert.equal(disabledData.get(key), '');
});

test('shared client validation covers roles, contacts, pincode and document limits', async () => {
  const { validateAccountForm, accountRoles } = await bundle('src/utils/userAccount.js');
  assert.equal(validateAccountForm(form()), '');
  assert.equal(accountRoles().includes('Admin'), false);
  assert.equal(accountRoles(true).includes('Admin'), true);
  for (const invalid of [{ name: ' ' }, { password: '123' }, { role: 'Unknown' }, { email: 'invalid' }, { phone: '123' },
    { alternateContact: '123' }, { pincode: '123' }, { documents: { name: 'script.exe', size: 10 } },
    { documents: { name: 'large.pdf', size: 6 * 1024 * 1024 } }]) assert.notEqual(validateAccountForm({ ...form(), ...invalid }), '');
});

test('shared submission selects the correct API and retains public token-scoped document upload', async () => {
  const calls = [];
  globalThis.accountTestAuthAPI = {
    register: async data => { calls.push(['register', data]); return { data: { data: { _id: 'pending-user' }, documentUploadToken: 'upload-token' } }; },
    uploadRegistrationDocument: async (id, data) => { calls.push(['upload', id, data]); },
  };
  globalThis.accountTestUsersAPI = { create: async data => { calls.push(['create', data]); return { data: { data: { _id: 'approved-user' } } }; } };
  const plugin = { name: 'isolate-account-api', setup(build) {
    build.onResolve({ filter: /^\.\/api$/ }, () => ({ path: 'account-api', namespace: 'test' }));
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const authAPI = globalThis.accountTestAuthAPI; export const usersAPI = globalThis.accountTestUsersAPI;' }));
  } };
  try {
    const { submitUserAccount } = await bundle('src/services/userAccount.js', [plugin]);
    const input = form(); input.documents = new File(['document'], 'document.pdf', { type: 'application/pdf' });
    await submitUserAccount(input);
    assert.equal(calls[0][0], 'register'); assert.equal(calls[0][1].has('documents'), false);
    assert.equal(calls[1][0], 'upload'); assert.equal(calls[1][1], 'pending-user');
    assert.equal(calls[1][2].get('uploadToken'), 'upload-token');
    await submitUserAccount(input, { admin: true });
    assert.equal(calls[2][0], 'create'); assert.equal(calls[2][1].get('documents').name, 'document.pdf');
    let uploadFailed = false;
    globalThis.accountTestAuthAPI.uploadRegistrationDocument = async () => { throw new Error('Upload failed'); };
    const response = await submitUserAccount(input, { onDocumentError: () => { uploadFailed = true; } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(response.data.data._id, 'pending-user'); assert.equal(uploadFailed, true);
  } finally {
    delete globalThis.accountTestAuthAPI; delete globalThis.accountTestUsersAPI;
  }
});

test('user deletion waits for SweetAlert confirmation; cancel/dismiss never call the API', async () => {
  const deleted = [];
  let answer = { isConfirmed: false }, options, resolveConfirmation;
  globalThis.accountDeletionAPI = { delete: async id => { deleted.push(id); } };
  globalThis.accountDeletionSwal = { fire: async config => { options = config; return answer; } };
  const plugin = { name: 'isolate-user-deletion', setup(build) {
    build.onResolve({ filter: /^(\.\/api|sweetalert2)$/ }, args => ({ path: args.path, namespace: 'delete-test' }));
    build.onLoad({ filter: /.*/, namespace: 'delete-test' }, args => ({ contents: args.path === 'sweetalert2'
      ? 'export default globalThis.accountDeletionSwal;'
      : 'export const authAPI = {}; export const usersAPI = globalThis.accountDeletionAPI;' }));
  } };
  try {
    const { deleteUserAccount } = await bundle('src/services/userAccount.js', [plugin]);
    const user = { _id: 'target-user', name: 'Test user' };
    assert.equal(await deleteUserAccount(user), false);
    assert.equal(deleted.length, 0);
    answer = { isDismissed: true };
    assert.equal(await deleteUserAccount(user), false);
    assert.equal(deleted.length, 0);
    globalThis.accountDeletionSwal.fire = config => { options = config; return new Promise(resolve => { resolveConfirmation = resolve; }); };
    const pending = deleteUserAccount(user);
    assert.equal(deleted.length, 0);
    assert.ok(options.text.includes(user.name));
    assert.equal(options.showCancelButton, true); assert.equal(options.focusCancel, true);
    resolveConfirmation({ isConfirmed: true });
    assert.equal(await pending, true);
    assert.deepEqual(deleted, ['target-user']);
  } finally {
    delete globalThis.accountDeletionAPI; delete globalThis.accountDeletionSwal;
  }
});
