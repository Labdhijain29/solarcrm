// Intercepted API fixtures only. No application records are modified.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
async function main() {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1440,height:900 } });
    const output = path.resolve('test-results/enquiry-daily-summary'); fs.mkdirSync(output,{ recursive:true });
    const offices = [{ _id:'111111111111111111111111',name:'Ratlam Office',isActive:true },{ _id:'222222222222222222222222',name:'Indore Office',isActive:true }];
    let user = { _id:'333333333333333333333333',name:'Test Admin',role:'Admin',office:offices[0]._id,isActive:true };
    let day = '2026-11-20', fail = true, empty = false;
    const queries = [], errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.addInitScript(user => { localStorage.setItem('solar_user',JSON.stringify(user));localStorage.setItem('solar_token','fixture'); },user);
    await page.route('**/api/**',async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') throw new Error('Unexpected fixture write');
      let body = { success:true,data:[] };
      if (url.pathname.endsWith('/auth/me')) body.user = user;
      else if (/\/offices(?:\/public)?$/.test(url.pathname)) body.data = offices;
      else if (url.pathname.endsWith('/enquiries')) {
        queries.push(Object.fromEntries(url.searchParams));
        if (fail) return route.fulfill({ status:503,json:{ success:false,message:'Fixture unavailable' } });
        body = { success:true,day,today:day,data:[{ _id:'444444444444444444444444',name:'Customer',contact:'4567890123',enquiryType:'Sales Enquiry',status:'new',followUps:[] }],pagination:{ page:1,pages:3,total:120,limit:50 },overview:{ total:120,today:empty ? 0 : 8,overdue:empty ? 0 : 3,upcoming:5 } };
      } else if (url.pathname.endsWith('/leads')) body.pagination = { page:1,pages:1,total:0,limit:25 };
      else if (url.pathname.endsWith('/stats')) body.data = {};
      await route.fulfill({ json:body });
    });
    const dialog = page.getByRole('dialog',{ name:'Your Daily Follow-up Summary',exact:true });
    const summary = page.getByRole('button',{ name:'Summary',exact:true });
    const marker = office => `solar_enquiry_summary_${user._id}_${office._id}`;
    await page.goto('http://127.0.0.1:5188/dashboard/enquiries');
    await expect(page.getByRole('button',{ name:'Retry',exact:true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(summary).toBeDisabled();
    expect(await page.evaluate(key => localStorage.getItem(key),marker(offices[0]))).toBeNull();
    fail = false;
    await page.getByRole('button',{ name:'Retry',exact:true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Ratlam Office');
    await expect(dialog).toContainText('20 Nov 2026');
    await expect(dialog).toContainText('11 enquiries need attention.');
    await expect(dialog.getByRole('button',{ name:'8 enquiries due today',exact:true })).toBeVisible();
    await expect(dialog.getByRole('button',{ name:'3 enquiries overdue',exact:true })).toBeVisible();
    await expect(dialog.getByRole('button',{ name:'5 enquiries with upcoming follow-ups',exact:true })).toBeVisible();
    await expect(page.getByRole('button',{ name:'Close daily summary',exact:true })).toBeFocused();
    await page.screenshot({ path:path.join(output,'desktop.png'),animations:'disabled' });
    // Focus stays in the dialog and Escape closes it.
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button',{ name:'View All Due Follow-ups',exact:true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(summary).toBeEnabled();
    await expect(dialog).toHaveCount(0);
    // All three destinations reset filters/search and request the whole matching list.
    for (const [name,filter] of [['8 enquiries due today','today'],['3 enquiries overdue','overdue'],['5 enquiries with upcoming follow-ups','upcoming']]) {
      await summary.click();
      await dialog.getByRole('button',{ name,exact:true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByLabel('Follow-up date',{ exact:true })).toHaveValue(filter);
      await expect.poll(() => queries.at(-1)).toMatchObject({ page:'1',followUp:filter,conversion:'not-converted',search:'',sort:'due' });
      await expect(summary).toBeEnabled();
    }
    await page.getByPlaceholder('Search name, phone or IVRS...').fill('old search');
    await expect.poll(() => queries.at(-1)?.search).toBe('old search');
    await expect(summary).toBeEnabled();
    await summary.click();
    await dialog.getByRole('button',{ name:'View All Due Follow-ups',exact:true }).click();
    await expect(page.getByPlaceholder('Search name, phone or IVRS...')).toHaveValue('');
    await expect.poll(() => queries.at(-1)).toMatchObject({ page:'1',followUp:'due',conversion:'not-converted',search:'' });
    // Embedded pages share the same daily marker and keep a manual Summary action.
    for (const target of ['/dashboard/admin?tab=enquiries','/dashboard/manager']) {
      await page.goto(`http://127.0.0.1:5188${target}`);
      if (target.endsWith('manager')) await page.getByRole('button',{ name:'Enquiries',exact:true }).click();
      await expect(summary).toBeEnabled(); await expect(dialog).toHaveCount(0);
      await summary.click(); await expect(dialog).toBeVisible();
      await dialog.getByRole('button',{ name:'Close',exact:true }).click();
      await expect(summary).toBeFocused();
    }
    // Another office gets its own daily summary.
    await page.goto('http://127.0.0.1:5188/dashboard/enquiries');
    await expect(summary).toBeEnabled();
    await page.locator('.office-selector button').click();
    await page.getByRole('option',{ name:'Indore Office',exact:true }).click();
    await page.getByRole('button',{ name:'Switch Office',exact:true }).click();
    await page.waitForURL('**/dashboard');
    await page.goto('http://127.0.0.1:5188/dashboard/enquiries');
    await expect(dialog).toBeVisible(); await expect(dialog).toContainText('Indore Office');
    await dialog.getByRole('button',{ name:'Close',exact:true }).click();
    // New day and new user each show it again. Zero due has a helpful state.
    day = '2026-11-21'; empty = true;
    await page.reload(); await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('You’re all caught up.');
    await expect(dialog.getByRole('button',{ name:'View Enquiries',exact:true })).toBeVisible();
    await page.setViewportSize({ width:390,height:844 });
    await page.screenshot({ path:path.join(output,'mobile-clear.png'),animations:'disabled' });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.getByRole('button',{ name:'View Enquiries',exact:true }).click();
    await expect(page.getByLabel('Follow-up date',{ exact:true })).toHaveValue('all');
    user = { ...user,_id:'666666666666666666666666',role:'Enquiry Executive' }; empty = false;
    await page.reload(); await expect(dialog).toBeVisible();
    await page.screenshot({ path:path.join(output,'mobile.png'),animations:'disabled' });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.setViewportSize({ width:320,height:568 });
    await page.screenshot({ path:path.join(output,'small-mobile.png'),animations:'disabled' });
    await dialog.getByRole('button',{ name:'Close',exact:true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload(); await expect(summary).toBeEnabled(); await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log('Daily summary passed: load/retry, full counts, once per day/user/office, filters, embedded pages, keyboard, mobile and zero-due state.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error);process.exitCode = 1; });
