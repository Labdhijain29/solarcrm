// All API requests are intercepted. Browser checks never write application data.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pixel = await require('../../backend/node_modules/sharp')({ create: { width: 2, height: 2, channels: 3, background: '#ff9900' } }).png().toBuffer();
    await page.route('https://files.test/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
    const output = path.resolve(__dirname, '../../test-results/service-requests');
    fs.mkdirSync(output, { recursive: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let user = { _id: '111111111111111111111111', name: 'Service Admin', role: 'Admin', isActive: true };
    const manager = { _id: '222222222222222222222222', name: 'Test Service Manager', role: 'Service Manager', isActive: true };
    const other = { _id: '333333333333333333333333', name: 'Other Manager', role: 'Service Manager' };
    let eventId = 10;
    const event = (action, note = '') => ({ _id: `event-${eventId++}`, action, note, performedByName: user.name, timestamp: '2026-11-17T10:00:00Z', photos: [] });
    const requests = ['pending', 'on-hold', 'completed'].map((status, index) => ({
      _id: (index + 100).toString(16).padStart(24, '0'), requestNo: `SR-00000${index + 1}`,
      customerName: `Service Customer ${index + 1}`, contact: '4567890123', city: 'Ratlam', email: 'customer@test.local', address: 'Customer installation site',
      __v: 0, issue: 'Panel cleaning', description: 'Dust on panels. Please visit the site.', status, visitDate: '2026-11-20', assignedTo: index === 1 ? other : manager,
      createdBy: user, createdAt: '2026-11-16T10:00:00Z', updatedAt: '2026-11-17T10:00:00Z', history: [{ ...event('Created'), timestamp: '2026-11-16T10:00:00Z' }],
    }));
    let statusWrites = 0;
    let leadWrites = 0;
    let failActivity = false;
    await page.addInitScript(user => { localStorage.setItem('solar_user', JSON.stringify(user)); localStorage.setItem('solar_token', 'fixture'); }, user);
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const service = url.pathname.split('/service-requests')[1];
      let body = { success: true, data: [] }, status = 200;
      if (url.pathname.endsWith('/auth/me')) body = { success: true, user };
      else if (url.pathname.includes('/leads') && request.method() !== 'GET') leadWrites++;
      else if (service === '/managers') body.data = [manager, other];
      else if (service === '' && request.method() === 'GET') {
        const owned = requests.filter(item => user.role === 'Admin' || item.assignedTo._id === user._id);
        const filtered = owned.filter(item => url.searchParams.get('status') === 'All' || item.status === url.searchParams.get('status'));
        body = { success: true, data: filtered, counts: Object.fromEntries(['pending', 'on-hold', 'completed'].map(value => [value, owned.filter(item => item.status === value).length])), pagination: { page: 1, pages: 1, total: filtered.length, limit: 25 } };
      } else if (service === '' && request.method() === 'POST') {
        expect(request.postData()).toContain('New service customer');
        const created = { ...requests[0], _id: '444444444444444444444444', requestNo: 'SR-000004', customerName: 'New service customer', __v: 0, status: 'pending', assignedTo: manager, history: [{ ...event('Created'), timestamp: '2026-11-16T10:00:00Z' }] };
        requests.push(created);
        body = { success: true, data: created, message: 'Service request created.' };
      } else if (service && /^\/[a-f0-9]{24}/.test(service)) {
        const item = requests.find(item => item._id === service.split('/')[1]);
        if (service.endsWith('/status')) {
          const payload = request.postDataJSON();
          statusWrites++;
          expect(payload.currentStatus).toBe(item.status);
          if (payload.status === 'completed' && !payload.note.trim()) { status = 400; body = { message: 'A completion note is required.' }; }
          else {
            const action = item.status === 'completed' ? 'Reopened' : payload.status === 'completed' ? 'Completed' : payload.status === 'on-hold' ? 'On Hold' : 'Resumed';
            item.history.push({ ...event(action, payload.note), fromStatus: item.status, toStatus: payload.status });
            item.status = payload.status; item.__v++;
            body = { success: true, data: item, message: 'Service status updated.' };
          }
        } else if (service.endsWith('/activity')) {
          if (failActivity) { failActivity = false; status = 503; body = { message: 'Could not save update. Try again.' }; }
          else {
            const data = request.postData();
            expect(data).toContain('Site checked');
            item.__v++;
            item.history.push({ ...event('Note Added', 'Site checked'), photos: [{ fileKey: 'visit', fileUrl: 'https://files.test/visit.png', originalName: 'visit.png', mimeType: 'image/png' }] });
            body = { success: true, data: item, message: 'Service update saved.' };
          }
        } else if (request.method() === 'PUT') {
          const payload = request.postDataJSON();
          expect(payload.expectedVersion).toBe(item.__v);
          const changes = Object.entries(payload).filter(([field, value]) => field !== 'expectedVersion' && String(item[field] || '') !== String(value || '')).map(([field, value]) => ({ field, label: ({ issue: 'Issue', contact: 'Contact number', visitDate: 'Visit date' })[field] || field, oldValue: String(item[field] || ''), newValue: String(value || '') }));
          Object.entries(payload).filter(([field]) => field !== 'expectedVersion').forEach(([field, value]) => { item[field] = value; });
          item.__v++;
          item.history.push({ ...event('Details Edited'), changes });
          body = { success: true, message: 'Service request updated.', data: item };
        } else body.data = item;
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('http://127.0.0.1:5188/dashboard/service');
    await expect(page.getByLabel('Service status', { exact: true })).toHaveValue('pending');
    const table = page.locator('.service-requests-table');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByText('Service Tickets', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'View SR-000001', exact: true }).click();
    let details = page.getByRole('dialog', { name: /SR-000001/ });
    await expect(details).toBeVisible();
    await expect(details.getByRole('button', { name: 'Complete Request', exact: true })).toBeInViewport();
    await details.getByRole('button', { name: 'Add Update', exact: true }).click();
    await expect(details.getByLabel('Note', { exact: true })).toBeFocused();
    await details.getByLabel('Note', { exact: true }).fill('Site checked');
    await details.getByLabel('Photos (optional)', { exact: true }).setInputFiles({ name: 'visit.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
    failActivity = true;
    await details.getByRole('button', { name: 'Save Update', exact: true }).click();
    await expect(page.getByText('Could not save update. Try again.', { exact: true })).toBeVisible();
    await expect(details.getByLabel('Note', { exact: true })).toHaveValue('Site checked');
    await details.getByRole('button', { name: 'Save Update', exact: true }).click();
    await expect(details.getByText('Site checked', { exact: true })).toBeVisible();
    await expect(details.getByRole('link', { name: 'Open visit.png', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Change status for SR-000001', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Completed', exact: true })).toBeChecked();
    await page.getByRole('radio', { name: 'Completed', exact: true }).check();
    await expect(page.locator('.swal2-input-label')).toHaveText('Completion note (required)');
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'status-chooser.png') });
    await page.getByRole('radio', { name: 'On Hold', exact: true }).check();
    await expect(page.locator('.swal2-input-label')).toHaveText('Reason (optional)');
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(details.getByRole('button', { name: 'Change status for SR-000001', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Change status for SR-000001', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Pending', exact: true })).toBeChecked();
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(details.getByRole('button', { name: 'Complete Request', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Complete Request', exact: true }).click();
    const before = statusWrites;
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(page.getByText('A completion note is required.', { exact: true })).toBeVisible();
    expect(statusWrites).toBe(before);
    await page.locator('.swal2-textarea').fill('Panels cleaned and checked.');
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(details.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Reopen', exact: true }).click();
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(details.getByRole('button', { name: 'Complete Request', exact: true })).toBeVisible();
    await expect(details.locator('.service-history-entry')).toHaveCount(5);
    await expect(details.getByRole('button', { name: /Show older updates/ })).toBeVisible();
    expect(await details.evaluate(element => Boolean(element.querySelector('.service-history').compareDocumentPosition(element.querySelector('.service-request-actions')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await details.getByRole('button', { name: /Show older updates/ }).click();
    await expect(details.locator('.service-history-entry')).toHaveCount(6);
    await details.locator('.service-details-body').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(details.getByRole('button', { name: 'Complete Request', exact: true })).toBeInViewport();
    await expect(details.locator('.service-history-day')).toHaveCount(2);
    await expect(page.getByText('Service status updated.', { exact: true }).last()).toBeHidden();
    await details.locator('.service-details-body').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'desktop-details.png') });
    await details.getByRole('button', { name: 'Edit', exact: true }).click();
    let edit = page.getByRole('dialog', { name: 'Edit SR-000001', exact: true });
    await expect(edit.getByLabel('Service Manager *', { exact: true })).toHaveCount(0);
    await edit.getByLabel('Issue *', { exact: true }).fill('Inverter issue');
    await edit.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(details.locator('.service-history-changes')).toContainText('Panel cleaning');
    await expect(details.locator('.service-history-changes')).toContainText('Inverter issue');
    await details.getByRole('button', { name: 'Close service request', exact: true }).click();
    await page.getByRole('button', { name: 'New Service Request', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'New Service Request', exact: true });
    await form.getByRole('button', { name: 'Create Request', exact: true }).click();
    await expect(form.getByText('Customer name is required.', { exact: true })).toBeVisible();
    await form.getByLabel('Customer name *', { exact: true }).fill('New service customer');
    await form.getByLabel('Contact number *', { exact: true }).fill('4567890123');
    await form.getByLabel('Issue *', { exact: true }).fill('Inverter check');
    await form.getByLabel('Service Manager *', { exact: true }).selectOption(manager._id);
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'desktop-create.png') });
    await form.getByRole('button', { name: 'Create Request', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /SR-000004/ })).toBeVisible();
    await page.getByRole('button', { name: 'Close service request', exact: true }).click();
    await table.getByRole('button', { name: 'Change status for SR-000004', exact: true }).click();
    await page.getByRole('radio', { name: 'On Hold', exact: true }).check();
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Service status', { exact: true }).selectOption('on-hold');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await table.getByRole('button', { name: 'Change status for SR-000004', exact: true }).click();
    await page.getByRole('radio', { name: 'Pending', exact: true }).check();
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Service status', { exact: true }).selectOption('All');
    await expect(table.locator('tbody tr')).toHaveCount(4);
    await table.getByRole('button', { name: 'Change status for SR-000004', exact: true }).click();
    await page.getByRole('radio', { name: 'Completed', exact: true }).check();
    await expect(page.locator('.swal2-input-label')).toHaveText('Completion note (required)');
    await page.locator('.swal2-textarea').fill('Service done from the list.');
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(table.getByRole('button', { name: 'Change status for SR-000004', exact: true })).toContainText('Completed');
    await table.getByRole('button', { name: 'Change status for SR-000004', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Reopen as Pending', exact: true })).toBeChecked();
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await table.getByRole('button', { name: 'Edit SR-000004', exact: true }).click();
    edit = page.getByRole('dialog', { name: 'Edit SR-000004', exact: true });
    await edit.getByLabel('Contact number *', { exact: true }).fill('4567890999');
    await edit.getByLabel('Visit date (optional)', { exact: true }).fill('2026-11-29');
    await edit.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(table.locator('tr').filter({ hasText: 'SR-000004' })).toContainText('4567890999');
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    const filterPositions = await page.locator('.service-list-filters').evaluate(element => ({ search: element.querySelector('input').getBoundingClientRect().top, status: element.querySelector('select').getBoundingClientRect().top }));
    expect(Math.abs(filterPositions.search - filterPositions.status)).toBeLessThan(2);
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'desktop-list.png') });
    user = manager;
    await page.reload();
    await expect(page.getByLabel('Service status', { exact: true })).toHaveValue('pending');
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await page.getByLabel('Service status', { exact: true }).selectOption('All');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
    await expect(table).toBeHidden();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'mobile-list.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'View SR-000003', exact: true }).click();
    details = page.getByRole('dialog', { name: /SR-000003/ });
    await expect(details.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Reopen', exact: true }).click();
    await page.locator('.swal2-container').getByRole('button', { name: 'Save Status', exact: true }).click();
    await expect(details.getByRole('button', { name: 'Complete Request', exact: true })).toBeVisible();
    await expect(page.getByText('Service status updated.', { exact: true }).last()).toBeHidden();
    await details.locator('.service-details-body').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'mobile-details.png') });
    await details.locator('.service-request-actions').scrollIntoViewIfNeeded();
    await expect(details.getByRole('button', { name: 'Complete Request', exact: true })).toBeInViewport();
    await page.screenshot({ animations: 'disabled', path: path.join(output, 'mobile-actions.png') });
    await details.getByRole('button', { name: 'Close service request', exact: true }).click();
    await page.getByRole('button', { name: 'New Service Request', exact: true }).click();
    await expect(page.getByRole('dialog').getByLabel('Service Manager *', { exact: true })).toHaveCount(0);
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    expect(leadWrites).toBe(0);
    expect(errors).toEqual([]);
    console.log('Service dashboard desktop/mobile, Admin/Manager creation, notes/photos, hold/resume, completion and reopening passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
