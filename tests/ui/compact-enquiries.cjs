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
    const office = { _id:'555555555555555555555555',name:'Ratlam Office',code:'RTM',isActive:true };
    let user = { _id: '111111111111111111111111', name: 'Test Admin', office:office._id, role: 'Admin', isActive: true };
    const executiveId = '222222222222222222222222';
    const enquiries = [
      { _id: '333333333333333333333333', name: 'Enquiry Customer', contact: '4567890123', email: 'customer@example.com', ivrsNo: 'IVRS123', address: 'Full customer address, Road 12, Ratlam', city: 'Ratlam', state: 'Madhya Pradesh', pincode: '457001', enquiryType: 'Sales Enquiry', status: 'new', createdBy: executiveId, createdAt: '2026-11-16T10:00:00Z', notes: 'Customer requested a callback.', nextFollowUpDate: '2026-11-17', followUps: [{ note:'Latest callback update',createdAt:'2026-11-20T09:10:00Z',createdBy:executiveId,createdByName:'Executive' },{ note:'Older note',createdAt:'2026-11-19T09:10:00Z',createdBy:executiveId,createdByName:'Executive' }] },
      { _id: '444444444444444444444444', name: 'Service Customer', contact: '4567890124', city: 'Ratlam', enquiryType: 'Service Enquiry', status: 'contacted', createdBy: '555555555555555555555555', followUps: [] },
      { _id: '666666666666666666666666', name: 'Converted Customer', contact: '4567890125', enquiryType: 'Sales Enquiry', status: 'converted', convertedTo: '777777777777777777777777', followUps: [] },
    ];
    let largeList = false;
    const requests = [];
    let conversions = 0;
    await page.addInitScript(user => { localStorage.setItem('solar_user', JSON.stringify(user)); localStorage.setItem('solar_token', 'fixture'); }, user);
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'POST' && url.pathname.endsWith('/convert')) {
        conversions++;
        return route.fulfill({ contentType:'application/json',body:JSON.stringify({ success:true,message:'Lead created from enquiry.' }) });
      }
      if (request.method() !== 'GET') throw new Error('Unexpected write');
      let body = { success: true, data: [] };
      if (url.pathname.endsWith('/auth/me')) body = { success: true, user };
      else if (/\/offices(?:\/public)?$/.test(url.pathname)) body.data = [office];
      else if (url.pathname.endsWith('/enquiries')) {
        const params = url.searchParams;
        requests.push(Object.fromEntries(params));
        let rows = largeList ? Array.from({ length:123 },(_,i) => ({ ...enquiries[0],_id:String(i+100).padStart(24,'0'),name:`Customer ${String(i+1).padStart(3,'0')}`,nextFollowUpDate:null })) : [...enquiries];
        const total = rows.length;
        const conversion = params.get('conversion');
        if (conversion !== 'all') rows = rows.filter(row => (row.status === 'converted' || Boolean(row.convertedTo)) === (conversion === 'converted'));
        const search = (params.get('search') || '').toLowerCase();
        if (search) rows = rows.filter(row => [row.name,row.contact,row.ivrsNo].some(value => value?.toLowerCase().includes(search)));
        if (params.get('sort') === 'name-desc') rows.reverse();
        const count = rows.length, pages = Math.max(1,Math.ceil(count/50));
        const current = Math.min(Number(params.get('page') || 1),pages);
        body = { success:true,data:rows.slice((current-1)*50,current*50),pagination:{ page:current,pages,total:count,limit:50 },overview:{ total,today:0,overdue:largeList ? 0 : 1,upcoming:0 } };
      }
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
    await expect(customer).not.toContainText('IVRS123');
    await expect(customer).toContainText('Latest callback update');
    await expect(customer).toContainText('20 Nov 2026');
    await expect(customer).not.toContainText('Older note');
    await expect(table.locator('tbody tr').filter({ hasText:'Service Customer' })).toContainText('No follow-up yet');
    await expect(customer).toContainText('457001');
    await expect(customer.getByRole('button', { name: 'Create Lead', exact: true })).toBeVisible();
    const service = table.locator('tbody tr').filter({ hasText: 'Service Customer' });
    await expect(service.getByRole('button', { name: 'Create Lead', exact: true })).toHaveCount(0);
    await customer.getByRole('button',{ name:'Create Lead',exact:true }).click();
    await expect(page.getByRole('dialog',{ name:'Create lead from this enquiry?' })).toBeVisible();
    await page.getByRole('button',{ name:'No',exact:true }).click();
    expect(conversions).toBe(0);
    await customer.getByRole('button',{ name:'Create Lead',exact:true }).click();
    await page.getByRole('button',{ name:'Yes, Create Lead',exact:true }).click();
    await expect.poll(() => conversions).toBe(1);
    await expect(customer).toBeVisible();
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
    await expect(card).toContainText('Latest callback update');
    await expect(card).not.toContainText('IVRS123');
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
    // The same paged list is used on the standalone, Admin and Manager screens.
    largeList = true;
    user = { ...user,role:'Admin' };
    await page.setViewportSize({ width:1440,height:900 });
    for (const route of ['/dashboard/enquiries','/dashboard/admin?tab=enquiries','/dashboard/manager']) {
      await page.goto(`http://127.0.0.1:5188${route}`);
      if (route.endsWith('manager')) await page.getByRole('button',{ name:'Enquiries',exact:true }).click();
      const pagination = page.getByRole('navigation',{ name:'Enquiry pages' });
      await expect(pagination).toContainText('Showing 1-50 of 123 enquiries');
      await expect(table.locator('tbody tr')).toHaveCount(50);
      await pagination.getByRole('button',{ name:'Next',exact:true }).click();
      await expect(pagination).toContainText('Showing 51-100 of 123 enquiries');
      await expect(table.locator('tbody tr').first()).toContainText('Customer 051');
      await pagination.getByRole('button',{ name:'Page 3',exact:true }).click();
      await expect(pagination).toContainText('Showing 101-123 of 123 enquiries');
      await expect(table.locator('tbody tr')).toHaveCount(23);
      await expect(pagination.getByRole('button',{ name:'Next',exact:true })).toBeDisabled();
    }
    const search = page.getByPlaceholder(/Search.*name/i);
    await search.fill('Customer 123');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table).toContainText('Customer 123');
    expect(requests.at(-1)).toMatchObject({ page:'1',search:'Customer 123',limit:'50' });
    await search.fill('');
    const pagination = page.getByRole('navigation',{ name:'Enquiry pages' });
    await expect(pagination).toContainText('Showing 1-50 of 123 enquiries');
    await pagination.getByRole('button',{ name:'Next',exact:true }).click();
    await expect(pagination).toContainText('Showing 51-100');
    await page.getByLabel('Conversion status',{ exact:true }).selectOption('all');
    await expect(pagination).toContainText('Showing 1-50');
    expect(requests.at(-1)).toMatchObject({ page:'1',conversion:'all' });
    await page.setViewportSize({ width:390,height:844 });
    await pagination.getByRole('button',{ name:'Page 3',exact:true }).click();
    await expect(pagination).toContainText('Showing 101-123');
    await expect(page.locator('.crm-mobile-card')).toHaveCount(23);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path:path.join(output,'pagination-mobile.png'),fullPage:true });
    expect(errors).toEqual([]);
    console.log('Compact enquiries and 50-row pagination passed: desktop/mobile, embedded views, full-list search, page resets, details and permissions.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
