// API fixtures only. The browser never changes application accounts.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const admin = { _id: '111111111111111111111111', name: 'Test Admin', role: 'Admin', email: 'admin@test.local', phone: '9876543210', approvalStatus: 'approved', isActive: true, updatedAt: '2026-11-17T10:00:00Z' };
    const users = [admin, { _id: '222222222222222222222222', name: 'Original User', role: 'Sales Executive', email: 'original@test.local', phone: '9876543211', alternateContact: '9797979797', address: 'Original address', permanentAddress: 'Permanent address', state: 'Madhya Pradesh', city: 'Ratlam', pincode: '457001', dateOfJoining: '2026-11-16T00:00:00Z', franchiseEnabled: false, approvalStatus: 'approved', isActive: true, documentsFile: { fileUrl: 'https://files.test/document.pdf', originalName: 'document.pdf', mimeType: 'application/pdf' }, updatedAt: '2026-11-17T10:00:00Z' }, { _id: '333333333333333333333333', name: 'Pending User', role: 'Name Change Executive', email: 'pending@test.local', phone: '9876543212', approvalStatus: 'pending', isActive: false, updatedAt: '2026-11-17T10:00:00Z' }];
    let writes = 0;
    await page.addInitScript(user => { localStorage.setItem('solar_user', JSON.stringify(user)); localStorage.setItem('solar_token', 'fixture'); }, admin);
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      let body = { success: true, data: [] }, status = 200;
      if (url.pathname.endsWith('/auth/me')) body = { success: true, user: admin };
      else if (url.pathname.endsWith('/users')) body.data = users;
      else if (/\/users\/[a-f0-9]{24}$/.test(url.pathname)) {
        const user = users.find(user => user._id === url.pathname.split('/').at(-1));
        if (request.method() === 'PUT') {
          const data = request.postData();
          expect(data).not.toContain('name="password"');
          expect(data).toContain('name="expectedUpdatedAt"');
          const field = key => data.match(new RegExp('name="' + key + '"\\r\\n\\r\\n([^\\r]*)'))?.[1];
          writes++;
          if (field('email') === 'duplicate@test.local') { status = 400; body = { message: 'Email already in use.' }; }
          else {
            for (const key of ['name', 'phone', 'email', 'role', 'address', 'pincode', 'alternateContact', 'permanentAddress', 'state', 'city']) if (field(key) !== undefined) user[key] = field(key);
            user.updatedAt = '2026-11-17T11:00:00Z';
            body = { success: true, data: user, message: 'User updated successfully.' };
          }
        } else body.data = user;
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('http://127.0.0.1:5188/dashboard/users');
    await page.getByRole('button', { name: 'Edit Original User', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Edit User', exact: true });
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Original User');
    await expect(dialog.getByLabel('Contact', { exact: true })).toHaveValue('9876543211');
    await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Save Changes', exact: true })).toBeDisabled();
    await dialog.getByLabel('Name', { exact: true }).fill('Updated User');
    await dialog.getByLabel('Email Address', { exact: true }).fill('duplicate@test.local');
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(page.getByText('Email already in use.', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Updated User');
    await dialog.getByLabel('Email Address', { exact: true }).fill('updated@test.local');
    await dialog.getByRole('button', { name: /^Sales Executive/ }).click();
    await page.getByRole('option', { name: 'Service Manager', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const row = page.locator('tbody tr').filter({ hasText: 'updated@test.local' });
    await expect(row).toContainText('Updated User');
    await expect(row).toContainText('Service Manager');
    await page.getByRole('button', { name: 'Edit Test Admin', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Edit User', exact: true });
    await expect(dialog.getByRole('button', { name: /^Admin/ })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Close edit user', exact: true }).click();
    await page.getByRole('button', { name: /Unapproved/ }).click();
    await page.getByRole('button', { name: 'Edit Pending User', exact: true }).click();
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Pending User');
    await dialog.getByRole('button', { name: 'Close edit user', exact: true }).click();
    await page.getByRole('button', { name: /^Approved/ }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    await page.getByRole('button', { name: 'Edit Updated User', exact: true }).click();
    await expect(dialog.getByLabel('Email Address', { exact: true })).toHaveValue('updated@test.local');
    const output = path.resolve(__dirname, '../../test-results/user-edit');
    fs.mkdirSync(output, { recursive: true });
    await expect(dialog.getByRole('button', { name: 'Save Changes', exact: true })).toBeInViewport();
    expect(await dialog.evaluate(element => element.querySelector('.user-account-edit-scroll').getBoundingClientRect().bottom <= element.querySelector('.user-account-edit-actions').getBoundingClientRect().top)).toBe(true);
    await dialog.locator('.user-account-edit-scroll').evaluate(element => { element.scrollTop = 0; });
    await expect(page.getByText('User updated successfully.', { exact: true }).last()).toBeHidden();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'mobile-edit.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Close edit user', exact: true }).click();
    await page.getByRole('button', { name: 'Add User', exact: true }).click();
    await expect(page.getByRole('dialog').locator('input[type="password"]')).toHaveCount(1);
    expect(writes).toBe(2);
    expect(errors).toEqual([]);
    console.log('User editing desktop/mobile, prefilled fields, duplicate email retry, role change, self-role protection and Add User regression passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
