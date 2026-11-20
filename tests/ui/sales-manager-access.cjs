// API fixtures only: no application records are modified.
const { chromium, expect } = require('@playwright/test');
async function main() {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1440,height:900 } });
    const office = { _id:'555555555555555555555555',name:'Ratlam Office',code:'RTM',isActive:true };
    const user = { _id:'111111111111111111111111',name:'Sales Manager Test',role:'Sales Manager',office:office._id,isActive:true };
    const stages = [['Lead','manager','Manager Dashboard'],['Name Change','stage/name-change-executive','Name Change Dashboard'],['Registration','stage/registration-executive','Registration Dashboard'],['Bank Approval','stage/bank-finance-executive','Bank Dashboard'],['Loan Disbursement','stage/loan-officer','Loan Dashboard']];
    const lead = stage => ({ _id:'333333333333333333333333',leadId:1234,name:'Customer Test',phone:'4567890123',city:'Ratlam',capacity:'3kW',status:'active',currentStage:stage,assignedTo:{ _id:'222222222222222222222222',name:'Assigned executive',role:'Registration Executive' },history:[],createdAt:'2026-11-19T10:00:00Z' });
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.addInitScript(user => { localStorage.setItem('solar_user',JSON.stringify(user)); localStorage.setItem('solar_token','fixture'); },user);
    let selectedStage = 'Lead';
    await page.route('**/api/**',async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') throw new Error('Unexpected fixture write');
      let body = { success:true,data:[] };
      if (url.pathname.endsWith('/auth/me')) body.user = user;
      else if (/\/offices(?:\/public)?$/.test(url.pathname)) body.data = [office];
      else if (url.pathname.endsWith('/users/assignable')) body.data = [{ _id:'222222222222222222222222',name:'Available Executive',role:url.searchParams.get('role'),isActive:true }];
      else if (url.pathname.endsWith('/leads')) {
        selectedStage = url.searchParams.get('stage') || selectedStage;
        body.data = url.searchParams.has('completedStage') ? [] : [lead(selectedStage)];
        body.pagination = { page:1,pages:1,limit:25,total:body.data.length };
      } else if (/\/leads\/[a-f\d]{24}$/.test(url.pathname)) body.data = lead(selectedStage);
      else if (url.pathname.endsWith('/stats')) body.data = {};
      await route.fulfill({ contentType:'application/json',body:JSON.stringify(body) });
    });
    for (const [stage,path,label] of stages) {
      selectedStage = stage;
      await page.goto(`http://127.0.0.1:5188/dashboard/${path}`);
      await expect(page.locator('.crm-table tbody tr').filter({ hasText:'Customer Test' })).toBeVisible();
      for (const [,otherPath,otherLabel] of stages) await expect(page.locator('aside').getByRole('link',{ name:otherLabel,exact:true })).toHaveAttribute('href',`/dashboard/${otherPath}`);
      await expect(page.locator('aside').getByRole('link',{ name:'Admin Dashboard',exact:true })).toHaveCount(0);
      await expect(page.locator('aside').getByRole('link',{ name:'Users',exact:true })).toHaveCount(0);
      await page.locator('.crm-table tbody tr').filter({ hasText:'Customer Test' }).getByRole('button',{ name:'View',exact:true }).click();
      const modal = page.getByRole('dialog',{ name:'Lead details',exact:true });
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('button',{ name:'Edit',exact:true })).toBeVisible();
      await expect(modal.getByRole('button',{ name:'Reject',exact:true })).toBeVisible();
      await expect(modal.getByRole('button',{ name:'Reassign',exact:true })).toBeVisible();
      await expect(modal.getByRole('button',{ name:/Move to / })).toBeVisible();
      if (stage === 'Lead') await expect(modal.getByRole('group',{ name:'Move lead to' })).toBeVisible();
      if (stage !== 'Lead') await expect(page.locator('.crm-table tbody tr').filter({ hasText:'Customer Test' }).getByRole('button',{ name:/hold/i })).toHaveCount(1);
    }
    for (const path of ['admin','stage/installation-manager','offices/new']) {
      await page.goto(`http://127.0.0.1:5188/dashboard/${path}`);
      await expect(page).toHaveURL('http://127.0.0.1:5188/dashboard');
    }
    expect(errors).toEqual([]);
    console.log('Sales Manager UI: five dashboard links, edit/move/reject/reassign/hold controls and restricted routes passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
