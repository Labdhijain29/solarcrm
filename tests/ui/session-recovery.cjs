// Uses fixture APIs only. No local or production database is accessed.
const { chromium, expect } = require('@playwright/test');

async function main() {
  const browser = await chromium.launch({ headless:true });
  try {
    let storeModuleUrl = '';
    const context = await browser.newContext({ viewport:{ width:1440,height:900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('request',request => { if (!storeModuleUrl && new URL(request.url()).pathname === '/src/store/index.js') storeModuleUrl = request.url(); });
    const a = { _id:'111111111111111111111111',name:'Ratlam Office',code:'RTM',isActive:true };
    const b = { _id:'222222222222222222222222',name:'Indore Office',code:'IND',isActive:true };
    const old = '999999999999999999999999';
    const admin = { _id:'333333333333333333333333',name:'Test Admin',email:'admin@test.local',role:'Admin',office:a._id };
    const manager = { _id:'444444444444444444444444',name:'Test Manager',email:'manager@test.local',role:'Manager',office:b._id };
    const tokens = new Map([['existing',admin]]), requests = [], errors = [];
    let nextUser = admin, serial = 0, holdProfile = null, holdNotifications = null;
    page.on('pageerror',error => errors.push(error.message));
    await page.context().route('**/api/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const token = req.headers().authorization?.replace('Bearer ','');
      const user = tokens.get(token);
      requests.push({ path,token,office:req.headers()['x-office-id'] });
      if (path.endsWith('/auth/login')) {
        const token = `new-${++serial}`; tokens.set(token,nextUser);
        return route.fulfill({ json:{ success:true,token,user:nextUser } });
      }
      if (path.endsWith('/auth/logout')) return route.abort(); // Server offline must not prevent logout.
      if (path.endsWith('/offices/public')) return route.fulfill({ json:{ success:true,data:[a,b] } });
      if (!user) return route.fulfill({ status:401,json:{ success:false,message:'Token expired.' } });
      if (path.endsWith('/auth/me')) {
        if (holdProfile) { const hold = holdProfile; holdProfile = null; hold.started(); await hold.wait; }
        return route.fulfill({ json:{ success:true,user } }).catch(() => {});
      }
      if (path.endsWith('/offices')) return route.fulfill({ json:{ success:true,data:[a,b] } });
      if (path.endsWith('/users/notifications')) {
        if (holdNotifications) { const hold = holdNotifications; holdNotifications = null; hold.started(); await hold.wait; return route.fulfill({ json:{ success:true,data:[{ message:'Old private notification',read:false }] } }).catch(() => {}); }
        return route.fulfill({ json:{ success:true,data:[] } });
      }
      if (path.endsWith('/enquiries/follow-ups/due')) return route.fulfill({ json:{ success:true,data:{ total:0,items:[] } } });
      if (path.endsWith('/dashboard/stats')) return route.fulfill({ json:{ success:true,data:{ totalLeads:0,activeLeads:0,completedLeads:0,rejectedLeads:0,conversionRate:0,stageStats:[],sourceStats:[],monthlyLeads:[],pendingRegistrations:[] } } });
      return route.fulfill({ json:{ success:true,data:[] } });
    });
    await page.goto('http://127.0.0.1:5188/login');
    await page.getByRole('button',{name:'Login',exact:true}).waitFor();
    if (!storeModuleUrl) throw new Error('Application store module was not loaded');
    await page.addInitScript(url => { window.sessionStoreUrl=url; },storeModuleUrl);
    await page.evaluate(url => { window.sessionStoreUrl=url; },storeModuleUrl);
    await page.evaluate(({admin,old}) => {
      localStorage.setItem('solar_token','existing'); localStorage.setItem('solar_user',JSON.stringify({ ...admin,office:old }));
      localStorage.setItem('solar_office',old); localStorage.setItem(`solar_office_${admin._id}`,old);
      localStorage.setItem('solar_theme','dark'); localStorage.setItem('solar_custom_preference','keep');
      localStorage.setItem('solar_remember_me','true'); sessionStorage.setItem('unrelated','keep');
    },{ admin,old });
    await page.goto('http://127.0.0.1:5188/dashboard/offices');
    await expect(page.getByRole('heading',{ name:'Offices',exact:true })).toBeVisible();
    await expect(page.locator('.office-selector')).toContainText('Ratlam Office');
    expect(await page.evaluate(() => localStorage.getItem('solar_office'))).toBe(a._id);
    expect(requests.filter(item => /\/auth\/me$|\/offices$/.test(item.path)).every(item => !item.office)).toBeTruthy();
    console.log('Passed: stale local office recovers from the current database without clearing site data.');

    // Valid choices survive a reload within the same session.
    await page.evaluate(({userId,office}) => { localStorage.setItem(`solar_office_${userId}`,office); localStorage.setItem('solar_office',office); },{ userId:admin._id,office:b._id });
    await page.reload(); await expect(page.locator('.office-selector')).toContainText('Indore Office');
    await page.evaluate(async () => {
      localStorage.setItem('solar_office_other_user','old-office');
      const { useAppStore } = await import(window.sessionStoreUrl);
      useAppStore.setState({ notifications:[{ message:'Private',read:false }],unreadCount:1,sidebarOpen:true });
    });
    await page.evaluate(async () => { const { useAppStore } = await import(window.sessionStoreUrl); useAppStore.getState().closeSidebar(); });
    await page.getByRole('button',{ name:'Account menu',exact:true }).click();
    await page.getByRole('button',{ name:/Logout$/ }).click();
    await page.waitForURL('**/login');
    const clean = await page.evaluate(async () => {
      const { useAppStore } = await import(window.sessionStoreUrl);
      return { keys:Object.keys(localStorage).filter(key => key.startsWith('solar_office') || ['solar_user','solar_token'].includes(key)),notifications:useAppStore.getState().notifications,unread:useAppStore.getState().unreadCount,theme:localStorage.getItem('solar_theme'),preference:localStorage.getItem('solar_custom_preference'),remember:localStorage.getItem('solar_remember_me'),unrelated:sessionStorage.getItem('unrelated') };
    });
    expect(clean).toEqual({ keys:[],notifications:[],unread:0,theme:'dark',preference:'keep',remember:'true',unrelated:'keep' });
    const signIn = async user => {
      nextUser = user;
      await page.getByPlaceholder('Enter email',{exact:true}).fill(user.email);
      await page.locator('input[type="password"]').fill('fixture123');
      await page.getByRole('button',{name:'Login',exact:true}).click();
      await page.waitForURL('**/dashboard');
      if (user.role === 'Admin') await expect(page.locator('.office-selector')).toContainText('Ratlam Office');
      else await expect(page.locator('.office-name')).toHaveText('Indore Office');
    };
    // A leftover key, even from an older app version, is cleared at fresh login.
    await page.evaluate(({userId,old}) => localStorage.setItem(`solar_office_${userId}`,old),{ userId:admin._id,old });
    await signIn(admin);
    expect(requests.filter(item => item.path.endsWith('/auth/login')).every(item => !item.token && !item.office)).toBeTruthy();
    console.log('Passed: logout clears office/session/notifications even when the backend is unavailable; login uses a fresh valid office.');

    let releaseProfile, releaseNotifications, startedProfile, startedNotifications;
    const profileStarted = new Promise(resolve => { startedProfile=resolve; });
    const notificationsStarted = new Promise(resolve => { startedNotifications=resolve; });
    holdProfile = { started:startedProfile,wait:new Promise(resolve => { releaseProfile=resolve; }) };
    holdNotifications = { started:startedNotifications,wait:new Promise(resolve => { releaseNotifications=resolve; }) };
    await page.evaluate(async () => {
      const { useAuthStore,useAppStore } = await import(window.sessionStoreUrl);
      const { usersAPI } = await import('/src/services/api.js');
      window.oldNotifications = usersAPI.getNotifications().then(response => useAppStore.getState().setNotifications(response.data.data)).catch(() => {});
      window.oldHydration = useAuthStore.getState().hydrateAuth();
    });
    await Promise.all([profileStarted,notificationsStarted]);
    await page.evaluate(async () => { const { useAuthStore } = await import(window.sessionStoreUrl); await useAuthStore.getState().logout(); });
    await page.waitForURL('**/login'); await signIn(manager);
    releaseProfile(); releaseNotifications();
    await page.evaluate(() => Promise.all([window.oldNotifications,window.oldHydration]));
    const state = await page.evaluate(async () => { const { useAuthStore,useAppStore } = await import(window.sessionStoreUrl); return { id:useAuthStore.getState().user?._id,notifications:useAppStore.getState().notifications }; });
    expect(state).toEqual({ id:manager._id,notifications:[] });
    console.log('Passed: delayed profile and notification responses cannot restore a signed-out account.');

    // Expiry clears all cached offices, then allows ordinary sign-in.
    tokens.clear();
    await page.reload(); await page.waitForURL('**/login');
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('solar_office') || ['solar_user','solar_token'].includes(key)))).toEqual([]);
    await signIn(admin);
    console.log('Passed: expired-session cleanup and immediate re-login.');

    const otherTab = await page.context().newPage();
    await otherTab.goto('http://127.0.0.1:5188/dashboard/offices');
    await expect(otherTab.locator('.office-selector')).toContainText('Ratlam Office');
    await page.evaluate(async () => { const { useAuthStore } = await import(window.sessionStoreUrl); await useAuthStore.getState().logout(); });
    await Promise.all([page.waitForURL('**/login'),otherTab.waitForURL('**/login')]);
    await signIn(admin);
    await expect(otherTab.locator('.office-selector')).toContainText('Ratlam Office');
    await otherTab.close();
    console.log('Passed: logout/sign-in synchronizes across tabs without a reload loop.');

    // A genuinely invalid assigned office must not grant a normal user another office.
    await page.evaluate(async () => { const { useAuthStore } = await import(window.sessionStoreUrl); await useAuthStore.getState().logout(); });
    await page.waitForURL('**/login');
    tokens.set('bad-office',{ ...manager,office:old });
    await page.evaluate(({manager,old}) => { localStorage.setItem('solar_token','bad-office');localStorage.setItem('solar_user',JSON.stringify({ ...manager,office:old })); },{ manager,old });
    await page.goto('http://127.0.0.1:5188/dashboard');
    await expect(page.getByRole('alert')).toContainText('Your assigned office is unavailable.');
    await expect(page.locator('.office-selector, .office-name')).toHaveCount(0);
    await page.getByRole('button',{name:'Sign out',exact:true}).click();
    await page.waitForURL('**/login');
    expect(errors).toEqual([]);
    console.log('Passed: invalid real assignments remain blocked and sign-out still works.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error);process.exitCode=1; });
