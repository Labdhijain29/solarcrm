// API fixtures only. No application records are modified.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let user = { _id: '111111111111111111111111', name: 'Test Admin', role: 'Admin', isActive: true };
    const executiveId = '222222222222222222222222';
    const enquiries = [
      { _id: '333333333333333333333333', name: 'Enquiry Customer', contact: '4567890123', email: 'customer@example.com', ivrsNo: 'IVRS123', address: 'Full customer address, Road 12, Ratlam', city: 'Ratlam', state: 'Madhya Pradesh', pincode: '457001', enquiryType: 'Sales Enquiry', status: 'new', createdBy: executiveId, createdAt: '2026-11-16T10:00:00Z', notes: 'Customer requested a callback.', nextFollowUpDate: '2026-11-17', followUps: [] },
      { _id: '444444444444444444444444', name: 'Service Customer', contact: '4567890124', city: 'Ratlam', enquiryType: 'Service Enquiry', status: 'contacted', createdBy: '555555555555555555555555', followUps: [] },
      { _id: '666666666666666666666666', name: 'Converted Customer', contact: '4567890125', enquiryType: 'Sales Enquiry', status: 'converted', convertedTo: '777777777777777777777777', followUps: [] },
    ];
    await page.addInitScript(user => { localStorage.setItem('solar_user', JSON.stringify(user)); localStorage.setItem('solar_token', 'fixture'); }, user);
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') throw new Error('Unexpected write');
      let body = { success: true, data: [] };
      if (url.pathname.endsWith('/auth/me')) body = { success: true, user };
      else if (url.pathname.endsWith('/enquiries')) body.data = enquiries;
      else if (url.pathname.endsWith('/stats')) body.data = {};
      else if (url.pathname.endsWith('/leads')) body.pagination = { page: 1, total: 0, pages: 1, limit: 25 };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('http://127.0.0.1:5188/dashboard/enquiries');
    const table = page.locator('.compact-enquiries-table');
    await expect(table).toBeVisible();
    await expect(table.locator('th')).toHaveText(['Customer', 'Location', 'Enquiry', 'Status', 'Received', 'Actions']);
    await expect(table.locator('tbody tr')).toHaveCount(2);
    const customer = table.locator('tbody tr').filter({ hasText: 'Enquiry Customer' });
    await expect(customer).toContainText('customer@example.com');
    await expect(customer).toContainText('IVRS123');
    await expect(customer).toContainText('457001');
    await expect(customer.getByRole('button', { name: 'Create Lead', exact: true })).toBeVisible();
    const service = table.locator('tbody tr').filter({ hasText: 'Service Customer' });
    await expect(service.getByRole('button', { name: 'Create Lead', exact: true })).toHaveCount(0);
    await customer.getByRole('button', { name: 'More actions for Enquiry Customer', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: 'View Details', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Enquiry Details', exact: true });
    await expect(details).toContainText(enquiries[0].address);
    await expect(details).toContainText(enquiries[0].notes);
    await page.getByRole('button', { name: 'Close enquiry details', exact: true }).click();
    await customer.getByRole('button', { name: 'More actions for Enquiry Customer', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Edit Enquiry', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close enquiry', exact: true }).click();
    await customer.getByRole('button', { name: 'Follow up', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Follow up for Enquiry Customer', exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    const output = path.resolve(__dirname, '../../test-results/compact-enquiries');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const route of ['/dashboard/admin?tab=enquiries', '/dashboard/manager']) {
      await page.goto(`http://127.0.0.1:5188${route}`);
      if (route.endsWith('manager')) await page.getByRole('button', { name: 'Enquiries', exact: true }).click();
      await expect(table).toBeVisible();
      await expect(table.locator('th')).toHaveCount(6);
    }
    await page.goto('http://127.0.0.1:5188/dashboard/enquiries');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(table).toBeHidden();
    const card = page.locator('.crm-mobile-card').filter({ hasText: 'Enquiry Customer' });
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(enquiries[0].address);
    await card.getByRole('button', { name: 'More actions for Enquiry Customer', exact: true }).click();
    await page.getByRole('menuitem', { name: 'View Details', exact: true }).click();
    await expect(details).toContainText(enquiries[0].address);
    await page.getByRole('button', { name: 'Close enquiry details', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    user = { ...user, _id: executiveId, role: 'Enquiry Executive' };
    await page.reload();
    const other = page.locator('.crm-mobile-card').filter({ hasText: 'Service Customer' });
    await other.getByRole('button', { name: 'More actions for Service Customer', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'View Details', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await card.getByRole('button', { name: 'More actions for Enquiry Customer', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel('Conversion status', { exact: true }).selectOption('converted');
    const converted = page.locator('.crm-mobile-card').filter({ hasText: 'Converted Customer' });
    await expect(converted.getByRole('button', { name: 'Create Lead', exact: true })).toHaveCount(0);
    await expect(converted.getByRole('button', { name: 'View follow-ups', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    console.log('Compact enquiries desktop/mobile, embedded views, details, edit, follow-up and permissions passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
