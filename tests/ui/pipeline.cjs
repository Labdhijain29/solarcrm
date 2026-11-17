// Every API request is intercepted. No application database is used.
const {
  chromium,
  expect
} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
async function main() {
  const browser = await chromium.launch({
    headless: true
  });
  try {
    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 900
      }
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = {
      _id: '111111111111111111111111',
      name: 'Pipeline Admin',
      role: 'Admin',
      isActive: true
    };
    const stages = ['Lead', 'Name Change', 'Registration', 'Bank Approval', 'Loan Disbursement', 'Dispatch', 'Installation', 'Net Metering', 'Subsidy', 'Subsidy Reading', 'Completed'];
    const leads = Array.from({
      length: 1107
    }, (_, i) => ({
      _id: (i + 100).toString(16).padStart(24, '0'),
      name: `Customer ${i}`,
      phone: '4567890123',
      leadId: i + 1,
      currentStage: 'Registration',
      status: 'active',
      city: 'Ratlam',
      capacity: '3kW',
      assignedTo: user,
      history: [],
      stageEnteredAt: '2026-01-01T00:00:00Z'
    }));
    leads.push({
      ...leads[0],
      _id: '222222222222222222222222',
      name: 'Name Change Customer',
      currentStage: 'Name Change'
    });
    await page.addInitScript(user => {
      localStorage.setItem('solar_user', JSON.stringify(user));
      localStorage.setItem('solar_token', 'fixture');
    }, user);
    let failPage = false;
    await page.route('**/api/**', async route => {
      const req = route.request(),
        url = new URL(req.url());
      if (req.method() !== 'GET') throw Error('Unexpected write request');
      let body = {
        success: true,
        data: []
      };
      if (url.pathname.endsWith('/auth/me')) body = {
        success: true,
        user
      };else if (url.pathname.endsWith('/stats')) body.data = {};else if (url.pathname.endsWith('/leads/pipeline')) {
        let matching = leads.filter(lead => !url.searchParams.get('search') || lead.name.includes(url.searchParams.get('search')));
        if (url.searchParams.has('stage')) {
          if (failPage) {
            failPage = false;
            return route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({
                message: 'Temporary pipeline error'
              })
            });
          }
          matching = matching.filter(lead => lead.currentStage === url.searchParams.get('stage'));
          const current = Number(url.searchParams.get('page') || 1);
          body = {
            success: true,
            data: matching.slice((current - 1) * 25, current * 25),
            pagination: {
              page: current,
              pages: Math.max(1, Math.ceil(matching.length / 25)),
              total: matching.length,
              limit: 25
            }
          };
        } else body = {
          success: true,
          data: stages.map(stage => ({
            stage,
            total: matching.filter(lead => lead.currentStage === stage).length,
            leads: matching.filter(lead => lead.currentStage === stage).slice(0, 5)
          })),
          options: {
            cities: ['Ratlam'],
            executives: [user]
          }
        };
      } else if (/\/leads\/[a-f0-9]{24}$/.test(url.pathname)) body.data = leads.find(lead => lead._id === url.pathname.split('/').at(-1));else if (url.pathname.includes('/users')) body.data = [user];
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
    });
    await page.goto('http://127.0.0.1:5188/dashboard/admin?tab=pipeline');
    const registration = page.locator('.pipeline-stage').filter({
      has: page.getByRole('heading', {
        name: 'Registration',
        exact: true
      })
    });
    await expect(registration.locator('.pipeline-lead-card')).toHaveCount(5);
    await registration.getByRole('button', {
      name: 'View all 1,107',
      exact: true
    }).click();
    const panel = page.getByRole('dialog', {
      name: /Registration/
    });
    await expect(panel.locator('.pipeline-result-row')).toHaveCount(25);
    await expect(panel.getByText('Showing 1-25 of 1,107', {
      exact: true
    })).toBeVisible();
    await panel.getByRole('button', {
      name: 'Next',
      exact: true
    }).click();
    await expect(panel.getByText('Showing 26-50 of 1,107', {
      exact: true
    })).toBeVisible();
    await panel.locator('.pipeline-result-row').first().click();
    await expect(page.getByRole('dialog', {
      name: 'Lead details',
      exact: true
    })).toBeVisible();
    await page.getByRole('button', {
      name: 'Close lead',
      exact: true
    }).click();
    await expect(panel.getByText('Showing 26-50 of 1,107', {
      exact: true
    })).toBeVisible();
    await panel.getByRole('spinbutton', {
      name: 'Page',
      exact: true
    }).fill('45');
    await panel.getByRole('button', {
      name: 'Go',
      exact: true
    }).click();
    await expect(panel.locator('.pipeline-result-row')).toHaveCount(7);
    await expect(panel.getByRole('button', {
      name: 'Next',
      exact: true
    })).toBeDisabled();
    await panel.getByRole('textbox', {
      name: 'Search pipeline',
      exact: true
    }).fill('Customer 1106');
    await expect(panel.getByText('Showing 1-1 of 1', {
      exact: true
    })).toBeVisible();
    await panel.getByRole('button', {
      name: 'Reset',
      exact: true
    }).click();
    await expect(panel.locator('.pipeline-result-row')).toHaveCount(25);
    failPage = true;
    await panel.getByRole('button', {
      name: 'Next',
      exact: true
    }).click();
    await expect(panel.getByRole('alert')).toContainText('Temporary pipeline error');
    await panel.getByRole('button', {
      name: 'Retry',
      exact: true
    }).click();
    await expect(panel.getByText('Showing 26-50 of 1,107', {
      exact: true
    })).toBeVisible();
    const output = path.resolve(__dirname, '../../test-results/pipeline');
    fs.mkdirSync(output, {
      recursive: true
    });
    await page.screenshot({
      path: path.join(output, 'desktop-stage.png')
    });
    await panel.getByRole('button', {
      name: 'Close stage list',
      exact: true
    }).click();
    await page.screenshot({
      path: path.join(output, 'desktop-board.png'),
      fullPage: true
    });
    await page.setViewportSize({
      width: 390,
      height: 844
    });
    await page.getByLabel('Stage', {
      exact: true
    }).selectOption('Name Change');
    await page.locator('.pipeline-stage-selected').getByRole('button', {
      name: 'View all 1',
      exact: true
    }).click();
    const mobile = page.getByRole('dialog', {
      name: /Name Change/
    });
    await expect(mobile.locator('.pipeline-result-row')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: path.join(output, 'mobile-stage.png')
    });
    await mobile.getByRole('button', {
      name: 'Close stage list',
      exact: true
    }).click();
    await page.setViewportSize({
      width: 1440,
      height: 900
    });
    await page.goto('http://127.0.0.1:5188/dashboard/manager');
    await page.getByRole('button', {
      name: 'Pipeline',
      exact: true
    }).click();
    await expect(page.locator('.pipeline-lead-card')).toHaveCount(6);
    expect(errors).toEqual([]);
    console.log('Desktop/mobile, 1107-lead pagination, search, detail return and retry passed.');
  } finally {
    await browser.close();
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
