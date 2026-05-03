const { test, expect } = require('@playwright/test')
const {
  detectFormFields,
  fillFormDynamically,
  getAuthForm,
  logDetectedFields,
} = require('./helpers/dynamicAuthForm')

test.describe('auth flows from detected forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.evaluate(() => localStorage.clear())
  })

  test('registration form detects required fields, validates missing input, and submits real API request', async ({ page }) => {
    await page.getByRole('button', { name: /^register$/i }).click()
    await expect(page.getByText('Create your account to continue')).toBeVisible()

    const form = await getAuthForm(page, /^register$/i)
    const fields = await detectFormFields(form)
    logDetectedFields('registration', fields)

    const requiredFields = fields.filter((field) => field.required)
    expect(requiredFields.length).toBeGreaterThan(0)

    await form.getByRole('button', { name: /^register$/i }).click()
    await expect.poll(() => form.evaluate((node) => node.checkValidity())).toBe(false)

    const seed = Date.now()
    const filled = await fillFormDynamically(page, form, fields, 'registration', seed)
    console.log('Registration test data:', filled)

    const registerResponse = page.waitForResponse((response) =>
      response.url().includes('/auth/register') && response.request().method() === 'POST'
    )
    await form.getByRole('button', { name: /^register$/i }).click()

    const response = await registerResponse
    const body = await response.json().catch(() => ({}))
    expect(response.status(), JSON.stringify(body)).toBe(201)
    expect(body.success).toBe(true)

    await expect(page.getByText('Login to access your dashboard')).toBeVisible()
  })

  test('login form detects fields, toggles Remember Me, and logs in through the real backend', async ({ page }) => {
    const form = await getAuthForm(page, /^(login|sign in)$/i)
    const fields = await detectFormFields(form)
    logDetectedFields('login', fields)

    const rememberField = fields.find((field) =>
      field.type === 'checkbox' && /remember/i.test(`${field.label} ${field.name} ${field.placeholder}`)
    )
    expect(fields.filter((field) => field.required).length).toBeGreaterThan(0)

    const filled = await fillFormDynamically(page, form, fields, 'login')
    console.log('Login test data:', { ...filled, Password: '<redacted>' })

    if (rememberField) {
      expect(filled[rememberField.label || rememberField.name || rememberField.placeholder]).toBe(true)
    }

    const loginResponse = page.waitForResponse((response) =>
      response.url().includes('/auth/login') && response.request().method() === 'POST'
    )
    await form.getByRole('button', { name: /^login$/i }).click()

    const response = await loginResponse
    const body = await response.json().catch(() => ({}))
    expect(response.status(), JSON.stringify(body)).toBe(200)
    expect(body.success).toBe(true)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('solar_token'))).toBeTruthy()

    if (rememberField) {
      await expect.poll(() => page.evaluate(() => localStorage.getItem('solar_remember_me'))).toBe('true')
      const rememberedLogin = await page.evaluate(() => JSON.parse(localStorage.getItem('solar_remembered_login') || 'null'))
      expect(rememberedLogin?.email).toBe((process.env.E2E_LOGIN_EMAIL || 'service@solarcrm.in').toLowerCase())
    }
  })
})
