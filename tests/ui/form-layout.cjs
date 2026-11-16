// Run against a local frontend only. Every API call is intercepted with fixtures.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const output = path.resolve(__dirname, '../../test-results/form-layout');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const user = { _id: '111111111111111111111111', name: 'Test Admin', role: 'Admin', isActive: true };
  const lead = { _id: '222222222222222222222222', name: 'Layout Test Lead', phone: '4567890123', email: 'test@example.com',
    currentStage: 'Lead', status: 'active', branch: 'Test Branch', source: 'Other', capacity: '3kW', roofType: 'Concrete',
    state: 'Madhya Pradesh', city: 'Ratlam', pincode: '457001', address: 'Test address', ivrsNo: 'LAYOUT1',
    assignedTo: user, createdBy: user, history: [{ stage: 'Lead', action: 'Created', performedByName: 'Test Admin', timestamp: '2026-11-16T12:00:00Z' }],
    bankData: { remark: 'Test bank remark' },
    salesExecutiveData: { accountNo: '12345', photoOneName: 'existing-photo.jpg' } };
  const enquiry = { _id: '333333333333333333333333', name: 'Layout Test Enquiry', contact: '4567890123', email: 'test@example.com',
    enquiryType: 'Sales Enquiry', state: 'Madhya Pradesh', city: 'Ratlam', pincode: '457001', status: 'new', ivrsNo: 'LAYOUT2', createdBy: user._id };
  const writes = [];
  await page.addInitScript(user => { localStorage.setItem('solar_user', JSON.stringify(user)); localStorage.setItem('solar_token', 'fixture-token'); }, user);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (!['GET', 'OPTIONS'].includes(request.method())) writes.push({ path: pathname, method: request.method(), body: request.postData() || '' });
    let body = { success: true, data: [] };
    if (pathname.endsWith('/auth/me')) body = { success: true, user };
    else if (/\/users(?:\/assignable)?$/.test(pathname)) body.data = [user];
    else if (pathname.endsWith('/enquiries')) body.data = request.method() === 'POST' ? enquiry : [enquiry];
    else if (pathname.endsWith('/enquiries/' + enquiry._id)) body.data = enquiry;
    else if (pathname.endsWith('/leads')) body = { success: true, data: [lead], pagination: { page: 1, pages: 1, total: 1, limit: 25 } };
    else if (pathname.endsWith('/leads/' + lead._id)) body.data = lead;
    await route.fulfill({ status: request.method() === 'POST' && /\/(leads|enquiries)$/.test(pathname) ? 201 : 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const base = process.env.FORM_UI_BASE_URL || 'http://127.0.0.1:5179';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Local frontend only');
  const openLead = async () => {
    await page.goto(base + '/dashboard/leads');
    await page.getByRole('button', { name: 'View', exact: true }).filter({ visible: true }).first().click();
    const view = page.getByRole('dialog', { name: 'Lead details', exact: true });
    await expect(view.locator('.lead-detail-grid')).toHaveCount(3);
    for (const [width, height, columns, name] of [[1440,900,3,'desktop'],[820,1000,2,'tablet'],[390,844,1,'mobile']]) {
      await page.setViewportSize({ width, height });
      for (const grid of await view.locator('.lead-detail-grid').all()) {
        await expect.poll(() => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns);
      }
      await expect(view.locator('.lead-detail-field-wide').filter({ hasText: 'Test bank remark' })).toHaveCount(1);
      expect(await view.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
      await page.screenshot({ animations: 'disabled', path: path.join(output, `lead-view-${name}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Edit lead', exact: true })).toBeVisible();
  };
  try {
    await openLead();
    const dialog = page.getByRole('dialog', { name: 'Edit lead', exact: true });
    await expect(dialog.getByText('Activity History', { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /Approve/ })).toHaveCount(0);
    await expect(dialog.locator('input[name="name"]')).toHaveCount(1);
    const fields = ['name','phone','email','state','city','pincode','address','dealNo','branch','brand','ivrsNo','capacity','roofType','monthlyBill','monthlyUnit','panCardNo','aadharNo','accountNo','ifscCode','generatedThrough','source','other','photoOne','photoTwo','documentPdf','aadharCard','panCard','bankStatement'];
    for (const name of fields) await expect(dialog.locator(`[data-field="${name}"]`)).toHaveCount(1);
    for (const [width, height, columns, name] of [[1440,900,3,'desktop'],[820,1000,2,'tablet'],[390,844,1,'mobile']]) {
      await page.setViewportSize({ width, height });
      await expect.poll(async () => dialog.locator('.form-fields-grid').first().evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns);
      const check = await dialog.evaluate(el => {
        const body = el.querySelector('.form-dialog-body'); body.scrollTop = body.scrollHeight;
        const footer = el.querySelector('.form-dialog-footer').getBoundingClientRect();
        return { overflow: el.scrollWidth > el.clientWidth, footerBottom: footer.bottom, footerTop: footer.top, viewport: innerHeight };
      });
      expect(check.overflow).toBe(false);
      expect(check.footerBottom).toBeLessThanOrEqual(check.viewport);
      expect(check.footerTop).toBeGreaterThanOrEqual(0);
      await page.screenshot({ animations: 'disabled', path: path.join(output, `lead-${name}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await dialog.getByLabel('Contact', { exact: true }).fill('456789012');
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(dialog.getByText('Contact number must contain exactly 10 digits.', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Contact', { exact: true })).toBeFocused();
    expect(writes).toHaveLength(0);
    await dialog.getByLabel('Contact', { exact: true }).fill('4567890123');
    await dialog.getByLabel('Customer Name', { exact: true }).fill('Changed draft');
    await dialog.locator('input[name="photoOne"]').setInputFiles({ name: 'new-photo.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Keep Editing', exact: true }).click();
    await expect(dialog.getByLabel('Customer Name', { exact: true })).toHaveValue('Changed draft');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard Changes', exact: true }).click();
    await expect(page.getByText('Activity History', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(dialog.getByLabel('Customer Name', { exact: true })).toHaveValue(lead.name);
    await expect(dialog.locator('input[name="photoOne"]')).toHaveValue('');
    await dialog.locator('input[name="photoOne"]').setInputFiles({ name: 'saved-photo.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(writes.at(-1).body).toContain('name="salesExecutiveData"');
    expect(writes.at(-1).body).toContain('name="ivrsNo"');
    expect(writes.at(-1).body).toContain('12345');
    expect(writes.at(-1).body).toContain('filename="saved-photo.png"');

    await page.goto(base + '/dashboard/enquiries');
    await page.getByRole('button', { name: 'Edit', exact: true }).filter({ visible: true }).first().click();
    const edit = page.getByRole('dialog', { name: 'Edit Enquiry', exact: true });
    await expect(edit).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'enquiry-edit-desktop.png') });
    await expect(edit.getByLabel('Name', { exact: true })).toHaveValue(enquiry.name);
    await edit.getByLabel('Name', { exact: true }).fill('Unsaved enquiry');
    await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Keep Editing', exact: true }).click();
    await expect(edit.getByLabel('Name', { exact: true })).toHaveValue('Unsaved enquiry');
    await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard Changes', exact: true }).click();
    await expect(edit).toHaveCount(0);
    await page.getByRole('button', { name: 'Enquiry Form', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Create Enquiry', exact: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'enquiry-create-mobile.png') });
    await create.getByRole('button', { name: 'Submit Enquiry', exact: true }).click();
    await expect(create.locator('[data-field="name"] .form-field-error')).toBeVisible();
    await create.getByLabel('Name *', { exact: true }).fill('New enquiry');
    await create.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard Changes', exact: true }).click();
    await expect(create).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '/dashboard/manager');
    await page.getByRole('button', { name: '+ New Lead', exact: true }).click();
    const manager = page.getByRole('dialog', { name: 'Create new lead', exact: true });
    await expect(manager.locator('.form-fields-grid').first()).toBeVisible();
    await manager.getByRole('button', { name: 'Create Lead', exact: true }).click();
    await expect(manager.locator('[data-field="name"] .form-field-error')).toBeVisible();
    await manager.getByLabel('Customer Name', { exact: true }).fill('Manager draft');
    await manager.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Keep Editing', exact: true }).click();
    await expect(manager.getByLabel('Customer Name', { exact: true })).toHaveValue('Manager draft');
    await manager.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Discard Changes', exact: true }).click();
    await expect(manager).toHaveCount(0);

    await page.goto(base + '/dashboard/sales');
    await page.getByRole('button', { name: 'Sales Executive Form', exact: true }).click();
    const sales = page.getByRole('dialog', { name: 'Create sales executive lead', exact: true });
    await expect(sales).toBeVisible();
    await expect(sales.locator('[data-field="salesExecutiveAssignee"]')).toHaveCount(1);
    for (const field of ['state', 'city', 'brand', 'capacity']) await expect(sales.locator(`.form-section [data-field="${field}"]`)).toHaveCount(1);
    await sales.getByLabel('Customer Name', { exact: true }).fill('Sales draft');
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'sales-lead-desktop.png') });
    await sales.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Discard Changes', exact: true }).click();
    await expect(sales).toHaveCount(0);
    expect(errors).toEqual([]);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ responsiveColumns: '3/2/1', stickyFooter: true, allLeadFieldsPresent: true, validationFocus: true, discardConfirmation: true, filesResetOnDiscard: true, existingPayloadFieldsPreserved: true, enquiryEditAndCreate: true, apiWritesMocked: writes.length, pageErrors: errors }, null, 2));
    console.log('Passed browser checks; all API requests used fixtures. Screenshots: ' + output);
  } catch (error) {
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'failure.png') });
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
