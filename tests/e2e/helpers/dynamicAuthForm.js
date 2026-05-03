const { expect } = require('@playwright/test')

const visibleControlsSelector = 'input:not([type="hidden"]):not(.searchable-select-hidden), textarea, select'
const submitButtonName = /^(login|log in|sign in|register|sign up|create account|create)$/i

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function safeRegex(value) {
  return new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
}

async function getAuthForm(page, submitName = submitButtonName) {
  const submit = page.getByRole('button', { name: submitName }).first()
  await expect(submit).toBeVisible()
  return submit.locator('xpath=ancestor::form[1]')
}

async function detectFormFields(form) {
  return form.evaluate((formNode) => {
    const normalized = (value) => String(value || '').replace(/\s+/g, ' ').trim()
    const visibleControlSelector = 'input:not([type="hidden"]):not(.searchable-select-hidden), textarea, select'
    const visibleControls = Array.from(formNode.querySelectorAll(visibleControlSelector))
    const customSelectButtons = Array.from(formNode.querySelectorAll('.searchable-select button[aria-haspopup="listbox"]'))

    const getNearestLabel = (element) => {
      const explicit = element.id
        ? formNode.querySelector(`label[for="${CSS.escape(element.id)}"]`)
        : null
      const implicit = element.closest('label')
      const customSelectContainerLabel = element.closest('.searchable-select')?.parentElement?.querySelector(':scope > label, :scope label.form-label')
      const containerLabel = element.closest('div')?.querySelector(':scope > label, :scope label.form-label')
      return normalized(explicit?.textContent || implicit?.textContent || customSelectContainerLabel?.textContent || containerLabel?.textContent)
    }

    const fields = []
    const hiddenCustomSelects = new Set()

    Array.from(formNode.elements).forEach((element) => {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return
      if (element.disabled) return

      const isHiddenCustomSelect = element.matches('input.searchable-select-hidden')
      if (isHiddenCustomSelect) {
        hiddenCustomSelects.add(element)
        const root = element.closest('.searchable-select')
        const button = root?.querySelector('button[aria-haspopup="listbox"]')
        fields.push({
          kind: 'custom-select',
          label: getNearestLabel(element),
          name: element.getAttribute('name') || '',
          placeholder: normalized(button?.textContent),
          required: element.required,
          value: element.value,
          buttonIndex: customSelectButtons.indexOf(button),
        })
        return
      }

      if (element.type === 'hidden' || element.matches('.searchable-select-hidden') || hiddenCustomSelects.has(element)) return

      fields.push({
        kind: element.tagName.toLowerCase() === 'select' ? 'select' : element.tagName.toLowerCase(),
        label: getNearestLabel(element),
        name: element.getAttribute('name') || '',
        placeholder: element.getAttribute('placeholder') || '',
        type: element.getAttribute('type') || element.type || element.tagName.toLowerCase(),
        required: element.required,
        value: element.value,
        controlIndex: visibleControls.indexOf(element),
        maxLength: element.maxLength > 0 ? element.maxLength : null,
      })
    })

    return fields
  })
}

function logDetectedFields(flow, fields) {
  console.log(`\nDetected ${flow} fields:`)
  fields.forEach((field, index) => {
    console.log(
      `${index + 1}. ${field.kind} ${field.type || ''}`.trim()
      + ` | label="${field.label || '-'}"`
      + ` | placeholder="${field.placeholder || '-'}"`
      + ` | name="${field.name || '-'}"`
      + ` | required=${field.required}`
    )
  })
}

async function locatorForField(page, form, field) {
  const label = normalizeText(field.label)
  const placeholder = normalizeText(field.placeholder)

  if (field.kind !== 'custom-select' && label) {
    const byLabel = page.getByLabel(safeRegex(label))
    if (await byLabel.count() === 1) return byLabel
  }

  if (field.kind !== 'custom-select' && placeholder) {
    const byPlaceholder = form.getByPlaceholder(safeRegex(placeholder))
    if (await byPlaceholder.count() === 1) return byPlaceholder
  }

  if (field.kind === 'custom-select') {
    return form.locator('.searchable-select button[aria-haspopup="listbox"]').nth(field.buttonIndex)
  }

  return form.locator(visibleControlsSelector).nth(field.controlIndex)
}

function valueForField(field, flow, seed) {
  const text = `${field.label} ${field.name} ${field.placeholder}`.toLowerCase()
  const type = String(field.type || '').toLowerCase()

  if (flow === 'login' && (type === 'email' || text.includes('email'))) {
    return process.env.E2E_LOGIN_EMAIL || 'service@solarcrm.in'
  }
  if (flow === 'login' && (type === 'password' || text.includes('password'))) {
    return process.env.E2E_LOGIN_PASSWORD || 'service123'
  }
  if (type === 'email' || text.includes('email')) return `e2e-${seed}@example.com`
  if (type === 'password' || text.includes('password')) return 'Test@123456'
  if (type === 'date' || text.includes('joining')) return '2026-05-03'
  if (text.includes('phone') || text.includes('contact')) return '9876543210'
  if (text.includes('pin')) return '400001'
  if (text.includes('name')) return `E2E Test ${seed}`
  if (text.includes('address')) return 'E2E Test Address'
  return `E2E ${normalizeText(field.label || field.name || field.placeholder || 'value')}`
}

async function selectFirstCustomOption(page, form, field) {
  if (field.value) return
  const trigger = await locatorForField(page, form, field)
  await trigger.click()
  const firstOption = page.getByRole('option').first()
  await expect(firstOption).toBeVisible()
  await firstOption.click()
}

async function fillFormDynamically(page, form, fields, flow, seed = Date.now()) {
  const filled = {}

  for (const field of fields) {
    if (!field.required && flow !== 'login') continue
    if (field.type === 'file' && !field.required) continue

    if (field.kind === 'custom-select') {
      await selectFirstCustomOption(page, form, field)
      filled[field.label || field.name || field.placeholder] = field.value || '<selected first option>'
      continue
    }

    const locator = await locatorForField(page, form, field)
    const type = String(field.type || '').toLowerCase()

    if (type === 'checkbox') {
      await locator.check()
      filled[field.label || field.name || field.placeholder] = true
      continue
    }

    if (field.kind === 'select') {
      const selected = await locator.evaluate((select) => {
        const option = Array.from(select.options).find((item) => item.value && !item.disabled)
        return option?.value || ''
      })
      if (selected) await locator.selectOption(selected)
      filled[field.label || field.name || field.placeholder] = selected
      continue
    }

    if (type === 'file') continue

    const value = valueForField(field, flow, seed)
    await locator.fill(value)
    filled[field.label || field.name || field.placeholder] = value
  }

  return filled
}

module.exports = {
  detectFormFields,
  fillFormDynamically,
  getAuthForm,
  logDetectedFields,
  submitButtonName,
}
