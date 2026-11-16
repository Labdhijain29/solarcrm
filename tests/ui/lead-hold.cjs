// Every API call is intercepted. This test never writes to an application DB.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
async function main() {
  const output = path.resolve(__dirname, '../../test-results/lead-hold');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const user = { _id: '111111111111111111111111', name: 'Test Admin', role: 'Admin', isActive: true };
  const stages = [['Registration', 'registration-executive'], ['Bank Approval', 'bank-finance-executive'], ['Loan Disbursement', 'loan-officer'], ['Dispatch', 'dispatch-manager'], ['Installation', 'installation-manager']];
  const leads = stages.flatMap(([stage], i) => ['active', 'on-hold', 'rejected', 'completed'].map((status, j) => ({
    _id: (100 + i * 4 + j).toString(16).padStart(24, '0'), name: `${stage} ${status}`, phone: '4567890123', assignedTo: user,
    currentStage: stage, status, city: 'Ratlam', capacity: '3kW', source: 'Other', branch: 'Test', history: [],
  })));
  let writes = 0;
  const requests = [];
  await page.addInitScript(user => { localStorage.setItem('solar_user', JSON.stringify(user)); localStorage.setItem('solar_token', 'fixture'); }, user);
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    let body = { success: true, data: [] }, status = 200;
    if (url.pathname.endsWith('/auth/me')) body = { success: true, user };
    else if (/\/leads\/[a-f0-9]+\/status$/.test(url.pathname)) {
      writes++;
      const lead = leads.find(item => item._id === url.pathname.split('/').at(-2));
      const payload = request.postDataJSON();
      expect(payload.stage).toBe(lead.currentStage);
      lead.status = payload.status;
      lead.history.push({ action: payload.status === 'on-hold' ? 'On Hold' : 'Resumed', note: payload.note });
      body = { success: true, message: lead.status === 'on-hold' ? 'Lead put on hold.' : 'Lead resumed.', data: lead };
    } else if (url.pathname.endsWith('/leads')) {
      requests.push(Object.fromEntries(url.searchParams));
      const selected = url.searchParams.has('completedStage') ? [] : leads.filter(lead =>
        (!url.searchParams.get('stage') || lead.currentStage === url.searchParams.get('stage')) &&
        (!url.searchParams.get('status') || url.searchParams.get('status').split(',').includes(lead.status)));
      body = { success: true, data: selected, pagination: { page: 1, pages: 1, total: selected.length, limit: 25 } };
    } else if (url.pathname.includes('/users')) body.data = [user];
    else if (url.pathname.endsWith('/stats')) body.data = {};
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const base = process.env.FORM_UI_BASE_URL || 'http://127.0.0.1:5179';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Local frontend only');
  const visible = locator => locator.filter({ visible: true }).first();
  try {
    for (const [stage, route] of stages) {
      await page.goto(base + '/dashboard/stage/' + route);
      const filter = page.getByRole('combobox', { name: 'Lead status filter', exact: true });
      await expect(filter).toHaveValue('active');
      const activeName = `${stage} active`, heldName = `${stage} on-hold`;
      await expect(visible(page.getByText(activeName, { exact: true }))).toBeVisible();
      await expect(page.getByText(heldName, { exact: true })).toHaveCount(0);
      await visible(page.getByRole('button', { name: `Put on hold: ${activeName}`, exact: true })).click();
      await expect(page.getByLabel('Reason (optional)', { exact: true })).toBeVisible();
      if (stage === 'Registration') await page.screenshot({ animations: 'disabled', path: path.join(output, 'hold-confirmation.png') });
      await page.getByRole('button', { name: 'Confirm Hold', exact: true }).click();
      await expect(page.getByText(activeName, { exact: true })).toHaveCount(0);
      expect(leads.find(lead => lead.name === activeName).history.at(-1).note).toBe('');
      await filter.selectOption('on-hold');
      await expect(visible(page.getByText(activeName, { exact: true }))).toBeVisible();
      await expect(visible(page.getByText(heldName, { exact: true }))).toBeVisible();
      await visible(page.getByRole('button', { name: `Resume: ${activeName}`, exact: true })).click();
      await page.getByRole('button', { name: 'Resume Lead', exact: true }).click();
      await expect(page.getByText(activeName, { exact: true })).toHaveCount(0);
      await filter.selectOption('All');
      await expect(visible(page.getByText(activeName, { exact: true }))).toBeVisible();
      await expect(visible(page.getByText(heldName, { exact: true }))).toBeVisible();
      await expect(page.getByText(`${stage} rejected`, { exact: true })).toHaveCount(0);
      await expect(page.getByText(`${stage} completed`, { exact: true })).toHaveCount(0);
      await visible(page.getByRole('button', { name: `Put on hold: ${activeName}`, exact: true })).click();
      await page.getByLabel('Reason (optional)', { exact: true }).fill('Waiting for documents');
      await page.getByRole('button', { name: 'Confirm Hold', exact: true }).click();
      await expect(filter).toHaveValue('All');
      await expect(visible(page.getByRole('button', { name: `Resume: ${activeName}`, exact: true }))).toBeVisible();
      expect(leads.find(lead => lead.name === activeName).history.at(-1).note).toBe('Waiting for documents');
      await visible(page.getByRole('button', { name: `Resume: ${activeName}`, exact: true })).click();
      await page.getByRole('button', { name: 'Resume Lead', exact: true }).click();
      await expect(visible(page.getByRole('button', { name: `Put on hold: ${activeName}`, exact: true }))).toBeVisible();
      const beforeCancel = writes;
      await visible(page.getByRole('button', { name: `Put on hold: ${activeName}`, exact: true })).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(writes).toBe(beforeCancel);
      if (stage === 'Dispatch') {
        const heldRow = page.locator('tr').filter({ hasText: heldName });
        await expect(heldRow.getByRole('button', { name: 'Create Bill', exact: true })).toBeDisabled();
      }
      await page.reload();
      await expect(filter).toHaveValue('active');
      await expect(page.getByText(heldName, { exact: true })).toHaveCount(0);
      console.log(`Passed ${stage}: default Active, optional reason, hold/resume, All, Cancel, reload.`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await visible(page.getByRole('button', { name: 'Put on hold: Installation active', exact: true })).click();
    await expect(page.getByLabel('Reason (optional)', { exact: true })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'hold-mobile.png') });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(errors).toEqual([]);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ dashboards: stages.map(([stage]) => stage), defaultActive: true, optionalReason: true,
      allExcludesRejectedAndCompleted: true, filterPreservedAfterChanges: true, mobileConfirmation: true, writesMocked: writes, pageErrors: errors }, null, 2));
  } catch (error) { await page.screenshot({ animations: 'disabled', path: path.join(output, 'failure.png') }); throw error; }
  finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
