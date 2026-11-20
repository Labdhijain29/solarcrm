const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function main() {
  const output = path.resolve(__dirname, '../../test-results/compact-lists');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const office = { _id:'555555555555555555555555',name:'Ratlam Office',code:'RTM',isActive:true };
  const user = { _id: '111111111111111111111111', name: 'Test Admin', office:office._id, role: 'Admin', isActive: true };
  const lead = { _id: '222222222222222222222222', name: 'Customer with a long name for checking readable wrapping', phone: '4567890123', branch: 'A long branch name', city: 'Ratlam',
    createdAt:'2026-11-16T10:00:00Z',updatedAt:'2026-11-20T10:00:00Z', currentStage: 'Registration', status: 'active', ivrsNo: 'IVRS12345678901', capacity: '10kW', source: 'Other', assignedTo: user, history: [] };
  const product = { _id: '333333333333333333333333', name: 'Solar module with a long product name', category: 'MODULE', brand: 'Test brand', type: 'Mono crystalline', capacity: '550W', quantity: 25, unit: 'pcs', status: 'In Stock' };
  const bill = { _id: '444444444444444444444444', billNo: 'BILL-123456', customerName: lead.name, mobile: lead.phone, leadId: lead._id, engineerName: 'Test Engineer', approvalStatus: 'Pending',
    grandTotal: 45000, dispatchDate: '2026-11-16', items: [{ productName: 'Detailed bill material A', category: 'MODULE', quantity: 10, unit: 'pcs', lineTotal: 40000 },
      { productName: 'Detailed bill material B', category: 'CABLE', quantity: 5, unit: 'm', lineTotal: 5000 }] };
  await page.addInitScript(user => { localStorage.setItem('solar_user', JSON.stringify(user)); localStorage.setItem('solar_token', 'fixture'); }, user);
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'OPTIONS'].includes(request.method())) throw new Error('Read-only UI test must not send writes');
    let body = { success: true, data: [] };
    if (url.pathname.endsWith('/auth/me')) body = { success: true, user };
    else if (/\/offices(?:\/public)?$/.test(url.pathname)) body.data = [office];
    else if (url.pathname.endsWith('/enquiries/follow-ups/due')) body.data = { total:0,items:[] };
    else if (url.pathname.endsWith('/leads')) {
      const data = url.searchParams.has('completedStage') ? [] : [{ ...lead, currentStage: url.searchParams.get('stage') || lead.currentStage }];
      body = { success: true, data, pagination: { page: 1, pages: 1, total: data.length, limit: 25 } };
    } else if (url.pathname.endsWith('/leads/' + lead._id)) body.data = lead;
    else if (url.pathname.includes('/users')) body.data = [user];
    else if (url.pathname.endsWith('/product')) body.data = [product];
    else if (url.pathname.endsWith('/dispatch')) body.data = [bill];
    else if (url.pathname.endsWith('/stats')) body.data = {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const base = process.env.FORM_UI_BASE_URL || 'http://127.0.0.1:5179';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Local frontend only');
  const checkWidths = async (region, name) => {
    for (const width of [1440, 1280, 1100, 820, 390]) {
      await page.setViewportSize({ width, height: 950 });
      await expect(region).toBeVisible();
      for (const wrap of await region.locator('.compact-table-wrap').all()) {
        await expect.poll(() => wrap.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        const box = await region.boundingBox();
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
      if (['leads','registration'].includes(name)) {
        if (await region.locator('table').isVisible()) await expect(region.locator('table').getByText('Created: 16 Nov 2026',{exact:true})).toBeVisible();
        else await expect(region.locator('.crm-mobile-row').filter({has:page.getByText('Created',{exact:true})})).toContainText('16 Nov 2026');
      }
      if (width === 1440 || width === 390) await page.screenshot({ animations: 'disabled', path: path.join(output, `${name}-${width}.png`) });
    }
    console.log(`Passed ${name}: no list horizontal overflow at 1440, 1280, 1100, 820, 390px.`);
  };
  try {
    await page.goto(base + '/dashboard/leads');
    const leads = page.locator('.compact-list-region');
    await expect(leads.locator('table th')).toHaveText(['Customer','Location','Project','Stage','Status','Actions']);
    await checkWidths(leads, 'leads');
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.getByRole('button', { name: 'View', exact: true }).filter({ visible: true }).first().click();
    const view = page.getByRole('dialog', { name: 'Lead details', exact: true });
    await view.locator('summary').filter({hasText:'Customer Details'}).click();
    await expect(view.getByText('Source', { exact: true })).toBeVisible();
    await expect(view.getByText('Pipeline Progress', { exact: true })).toHaveCount(1);
    await view.getByRole('button', { name: 'Close lead', exact: true }).click();
    await page.goto(base + '/dashboard/stage/registration-executive');
    await expect(page.locator('.compact-dashboard-table th')).toHaveText(['Customer','Location','Project','Status','Actions']);
    await checkWidths(page.locator('.compact-list-region'), 'registration');
    await page.goto(base + '/dashboard/inventory');
    await page.getByRole('button', { name: 'Stock', exact: true }).click();
    const stock = page.locator('.compact-list-region').filter({ has: page.getByRole('button', { name: /Excel CSV/ }) });
    await expect(stock.locator('table th')).toHaveText(['Product','Quantity','Status','Actions']);
    await checkWidths(stock, 'stock');
    await page.goto(base + '/dashboard/stage/dispatch-manager');
    const bills = page.locator('.compact-list-region').filter({ has: page.getByRole('heading', { name: 'Dispatch Bills', exact: true }) });
    await expect(bills.locator('table th')).toHaveText(['Bill / Customer','Status','Materials','Total','Date','Actions']);
    await checkWidths(bills, 'bills');
    await page.setViewportSize({ width: 1440, height: 950 });
    await bills.getByRole('button', { name: 'View', exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText('Detailed bill material A', { exact: true })).toBeVisible();
    await expect(page.getByText('Detailed bill material B', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close bill view', exact: true }).click();
    await checkWidths(page.locator('.dispatch-lead-queue'), 'dispatch-queue');
    await page.setViewportSize({ width:1440,height:950 });
    lead.createdAt = undefined;
    await page.goto(base + '/dashboard/leads');
    await expect(page.locator('table').getByText('Created: -',{exact:true})).toBeVisible();
    lead.createdAt = 'not-a-date';
    await page.reload();
    await expect(page.locator('table').getByText('Created: -',{exact:true})).toBeVisible();
    await expect(page.getByText('Invalid Date',{exact:true})).toHaveCount(0);
    expect(errors).toEqual([]);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ widths: [1440,1280,1100,820,390], lists: ['leads','registration','stock','bills','dispatch-queue'], overflow: false,
      creationDateDesktopAndMobile:true,missingOrInvalidDateFallback:true,stageHiddenOnStageDashboard: true, secondaryLeadDetailsAvailable: true, fullBillItemsAvailable: true, writes: 0, pageErrors: errors }, null, 2));
  } catch (error) { await page.screenshot({ animations: 'disabled', path: path.join(output, 'failure.png') }); throw error; }
  finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
