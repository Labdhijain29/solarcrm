// Browser UI checks use intercepted APIs only; no application records are written.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
async function main() {
  const browser = await chromium.launch({ headless:true });
  const output = path.resolve(__dirname,'../../test-results/offices'); fs.mkdirSync(output,{ recursive:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1440, height:900 }, hasTouch:true });
    const a = { _id:'111111111111111111111111',name:'Ratlam Office',code:'RTM',order:1,city:'Ratlam',state:'Madhya Pradesh',isActive:true };
    const b = { _id:'222222222222222222222222',name:'Indore Office',code:'IND',order:2,city:'Indore',isActive:true };
    let offices = [a,b], writes = [], requests = [], failNextReorder = false;
    const reorder = (office, requested) => {
      const others = offices.filter(item => item._id !== office._id);
      const position = requested === '' || requested == null ? others.length + 1 : Number(requested);
      others.splice(position - 1,0,office); offices = others;
      offices.forEach((item,index) => { item.order = index + 1; });
    };
    let user = { _id:'333333333333333333333333',name:'Office Admin',email:'admin@test.local',role:'Admin',office:a._id };
    page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(20000);
    page.on('console', m => { if (m.type() === 'error') console.log('Browser:',m.text()); });
    const errors = []; page.on('pageerror',error => errors.push(error.message));
    await page.addInitScript(user => { if (window.top !== window) return; if (!localStorage.getItem('solar_token')) { localStorage.setItem('solar_token','fixture'); localStorage.setItem('solar_user',JSON.stringify(user)); } },user);
    await page.route('**/api/**',async route => {
      const req = route.request(), url = new URL(req.url()); if (!['localhost','127.0.0.1'].includes(url.hostname)) return route.abort(); requests.push({ path:url.pathname,office:req.headers()['x-office-id'],method:req.method() });
      let body = { success:true,data:[] };
      if (url.pathname.endsWith('/auth/me')) body = { success:true,user };
      else if (url.pathname.endsWith('/offices/public') || url.pathname.endsWith('/offices')) {
        if (req.method() === 'POST') { writes.push(req.postDataJSON()); const office = { _id:'444444444444444444444444',...req.postDataJSON() }; reorder(office,req.postDataJSON().order); body.data = office; }
        else body.data = offices;
      } else if (/\/offices\/[^/]+$/.test(url.pathname)) {
        const office = offices.find(item => item._id === url.pathname.split('/').at(-1));
        if (req.method() === 'PUT' && req.postDataJSON().expectedOrder && failNextReorder) { failNextReorder=false; return route.fulfill({ status:409,json:{ success:false,message:'Office order changed. Please try again.' } }); }
        if (req.method() === 'PUT') { Object.assign(office,req.postDataJSON()); if (req.postDataJSON().order !== undefined) reorder(office,req.postDataJSON().order); writes.push(req.postDataJSON()); }
        body.data = office;
      } else if (url.pathname.endsWith('/enquiries/follow-ups/due')) body.data = { total:0,items:[] };
      else if (url.pathname.endsWith('/enquiries') && req.method() === 'POST') { writes.push(req.postDataJSON()); body.data = req.postDataJSON(); }
      else if (url.pathname.endsWith('/dashboard/stats')) body.data = { totalLeads:0,activeLeads:0,completedLeads:0,rejectedLeads:0,conversionRate:0,stageStats:[],sourceStats:[],monthlyLeads:[],pendingRegistrations:[] };
      await route.fulfill({ json:body });
    });
    console.log('Opening offices'); await page.goto('http://127.0.0.1:5188/dashboard/offices', { waitUntil:'domcontentloaded' });
    console.log('Loaded page'); await expect(page.getByRole('heading',{ name:'Offices',exact:true })).toBeVisible();
    await expect(page.locator('.office-selector')).toContainText('Ratlam Office');
    await expect(page.locator('.office-selector .office-switch-trigger')).toContainText('Current office');
    await page.locator('.app-topbar').screenshot({ path:path.join(output,'header-desktop.png'),animations:'disabled' });
    await page.locator('.office-selector button').click();
    await page.getByPlaceholder('Search offices...', { exact:true }).fill('Indore');
    await expect(page.getByRole('option')).toHaveText(['Indore Office']);
    await page.getByRole('option',{ name:'Indore Office',exact:true }).click();
    await page.getByRole('button',{ name:'Stay Here',exact:true }).click();
    await expect(page.locator('.office-selector')).toContainText('Ratlam Office');
    await page.locator('.office-selector button').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByRole('button',{ name:'Add Office',exact:true })).toHaveCount(0);
    await page.screenshot({ path:path.join(output,'listing.png'),animations:'disabled' });
    await page.locator('.office-selector button').click();
    await page.getByRole('option',{ name:'Indore Office',exact:true }).click();
    await page.getByRole('button',{ name:'Switch Office',exact:true }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.locator('.office-selector')).toContainText('Indore Office');
    await page.goto('http://127.0.0.1:5188/dashboard/users');
    await page.getByRole('button',{ name:'Add User',exact:true }).click();
    await expect(page.getByText('Franchise',{ exact:true })).toHaveCount(0);
    await expect(page.locator('input[name="office"]')).toHaveValue(b._id);
    await expect(page.locator('input[name="office"]').locator('..').getByRole('button')).toBeDisabled();
    await page.goto('http://127.0.0.1:5188/dashboard/offices/new');
    await page.getByLabel('Office name').fill('Neemuch Office');
    await page.getByLabel('Office code').fill('NMC');
    await page.getByLabel('Contact number').fill('4567890123');

    await page.screenshot({ path:path.join(output,'editor.png'),animations:'disabled' });
    await page.getByRole('button',{ name:'Save Office' }).click();
    await expect(page.getByRole('button',{ name:'Edit Neemuch Office',exact:true })).toBeVisible();
    expect(writes.at(-1).code).toBe('NMC');
    await expect(page.getByRole('spinbutton')).toHaveCount(0);
    const newHandle = page.getByRole('button',{ name:'Reorder Neemuch Office',exact:true });
    await newHandle.focus(); await page.keyboard.press('Space'); await page.keyboard.press('Home'); await page.keyboard.press('Space');
    await expect(page.getByText('Office order updated.',{exact:true}).first()).toBeVisible();
    expect(writes.at(-1).order).toBe(1);
    expect(writes.at(-1).expectedOrder).toEqual([a._id,b._id,'444444444444444444444444']);
    await expect(page.locator('.office-manager-row').first()).toHaveAttribute('aria-label','Edit Neemuch Office');
    await page.locator('.office-selector button').click();
    await expect(page.getByRole('option')).toHaveText(['Neemuch Office','Ratlam Office','Indore Office']);
    await page.keyboard.press('Escape');
    await page.getByRole('button',{ name:'Edit Indore Office',exact:true }).click();
    await expect(page.getByRole('heading',{ name:'Edit Office',exact:true })).toBeVisible();
    await expect(page.getByLabel('Office name')).toHaveValue('Indore Office');
    await expect(page.getByRole('button',{ name:'Edit Indore Office',exact:true })).toHaveAttribute('aria-current','true');
    const listBounds = await page.locator('.office-manager-list').boundingBox(), editorBounds = await page.locator('.office-editor').boundingBox();
    expect(editorBounds.x).toBeGreaterThan(listBounds.x + listBounds.width);
    expect(Math.abs(editorBounds.y - listBounds.y)).toBeLessThan(3);
    await page.screenshot({ path:path.join(output,'editing-desktop.png'),animations:'disabled' });
    await page.getByLabel('Contact number').fill('9876543210');

    await page.getByRole('button',{ name:'Save Office' }).click();
    expect(writes.at(-1).phone).toBe('9876543210');
    const dragged = page.getByRole('button',{ name:'Reorder Indore Office',exact:true });
    const first = page.getByRole('button',{ name:'Reorder Neemuch Office',exact:true });
    const source = await dragged.boundingBox(), target = await first.boundingBox();
    await page.mouse.move(source.x + source.width/2, source.y + source.height/2); await page.mouse.down();
    await page.mouse.move(target.x + target.width/2, target.y + 12,{steps:20}); await page.waitForTimeout(180);
    await page.screenshot({ path:path.join(output,'dragging.png'),animations:'disabled' });
    const dragSaved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes(`/offices/${b._id}`));
    await page.mouse.up(); await dragSaved;
    await expect(page.locator('.office-manager-row').first()).toHaveAttribute('aria-label','Edit Indore Office');
    await expect(page.getByText('Drag the handle to reorder.',{exact:true})).toBeVisible();
    const successfulWrites = writes.length;
    const lastHandle = page.getByRole('button',{ name:'Reorder Ratlam Office',exact:true });
    await lastHandle.focus(); await page.keyboard.press('Space'); await page.keyboard.press('Home'); await page.keyboard.press('Escape');
    expect(writes.length).toBe(successfulWrites);
    await expect(page.locator('.office-manager-row').first()).toHaveAttribute('aria-label','Edit Indore Office');
    failNextReorder = true;
    await lastHandle.focus(); await page.keyboard.press('Space'); await page.keyboard.press('Home'); await page.keyboard.press('Space');
    await expect(page.getByText('Office order changed. Please try again.',{exact:true}).first()).toBeVisible();
    await expect(page.locator('.office-manager-row').first()).toHaveAttribute('aria-label','Edit Indore Office');
    await page.getByRole('textbox',{name:'Search offices',exact:true}).fill('Ratlam');
    await expect(page.getByRole('button',{name:'Reorder Ratlam Office',exact:true})).toBeDisabled();
    await page.getByRole('textbox',{name:'Search offices',exact:true}).fill('');
    await page.goto('http://127.0.0.1:5188/contact');
    await expect(page.locator('input[name="office"]')).toHaveValue(a._id);
    await page.locator('input[name="office"]').locator('..').getByRole('button').click();
    await page.getByRole('option',{ name:'Indore Office',exact:true }).click();
    await page.locator('input[name="name"]').fill('Office customer');
    await page.locator('input[name="contact"]').fill('4567890123');
    await page.getByRole('button',{ name:'Submit Enquiry',exact:true }).click();
    await expect(page.getByRole('heading',{ name:'Enquiry Submitted!' })).toBeVisible();
    expect(writes.at(-1).office).toBe(b._id);
    const publicPost = requests.findLast(item => item.path.endsWith('/enquiries') && item.method === 'POST'); expect(publicPost.office).toBeUndefined();
    await page.setViewportSize({ width:390,height:844 });
    await page.goto('http://127.0.0.1:5188/dashboard/offices');
    await expect(page.locator('.office-selector')).toBeVisible();
    await page.locator('.app-topbar').screenshot({ path:path.join(output,'header-mobile.png'),animations:'disabled' });
    await page.screenshot({ path:path.join(output,'mobile.png'),animations:'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.goto('http://127.0.0.1:5188/dashboard/offices/new');
    await expect(page.getByRole('heading',{ name:'Manage Offices',exact:true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const cdp = await page.context().newCDPSession(page);
    await page.locator('.office-sortable-list').evaluate(element => { element.scrollTop=0; });
    const touchHandle = page.getByRole('button',{ name:'Reorder Neemuch Office',exact:true });
    await touchHandle.scrollIntoViewIfNeeded();
    const touchFrom = await touchHandle.boundingBox(), touchTo = await page.getByRole('button',{name:'Reorder Indore Office',exact:true}).boundingBox();
    const x = touchFrom.x + touchFrom.width/2, y = touchFrom.y + touchFrom.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for (let step=1;step<=18;step++) { await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(touchTo.y+10-y)*step/18}]}); await page.waitForTimeout(15); }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('.office-manager-row').first()).toHaveAttribute('aria-label','Edit Neemuch Office');
    await expect(page.getByText('Drag the handle to reorder.',{exact:true})).toBeVisible();
    await cdp.detach();
    await page.screenshot({ path:path.join(output,'manager-mobile.png'),animations:'disabled',fullPage:true });
    user = { ...user,role:'Manager',office:a._id };
    await page.goto('http://127.0.0.1:5188/dashboard/offices');
    await expect(page.locator('.office-selector')).toHaveCount(0);
    await expect(page.locator('.office-name-value')).toHaveText('Ratlam Office');
    expect(errors).toEqual([]);
    console.log('Passed: office listing, switch, user form, direct create/edit, public routing, mobile and role checks.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
