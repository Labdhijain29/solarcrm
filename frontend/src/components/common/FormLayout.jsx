import { Children, cloneElement, isValidElement, useId } from 'react'

const groups = {
  lead: [
    ['Customer', ['salesExecutiveAssignee', 'name', 'phone', 'email']],
    ['Address', ['state', 'city', 'pincode', 'address']],
    ['Project', ['ivrsNo', 'dealNo', 'branch', 'brand', 'capacity', 'roofType', 'monthlyBill', 'monthlyUnit', 'generatedThrough', 'source', 'other']],
    ['Bank & Identity', ['panCardNo', 'aadharNo', 'accountNo', 'ifscCode']],
    ['Documents', ['photoOne', 'photoTwo', 'documentPdf', 'aadharCard', 'panCard', 'bankStatement']],
  ],
  enquiry: [
    ['Customer & Enquiry', ['name', 'contact', 'email', 'ivrsNo', 'enquiryType', 'status']],
    ['Address', ['state', 'city', 'pincode', 'address']],
    ['Notes', ['notes']],
  ],
}

const controlOf = field => Children.toArray(field.props?.children).find(child => isValidElement(child) && child.props.name)
const fieldName = field => {
  const name = controlOf(field)?.props.name || ''
  return name === 'sales-registration-executive' ? 'salesExecutiveAssignee' : name.replace(/^(edit-|manager-lead-|sales-registration-)/, '')
}

// Keep the existing inputs and handlers; only organize and label their layout.
export function FormFields({ kind, children, errors = {}, clearError }) {
  const id = useId()
  const fields = Children.toArray(children)
  const assigned = new Set()
  const renderField = field => {
    const name = fieldName(field)
    const control = controlOf(field)
    const error = errors[name]
    const inputId = `${id}-${name}`
    const content = Children.map(field.props.children, child => {
      if (!isValidElement(child)) return child
      if (child === control || child.props.name === control?.props.name && child.props.name) {
        return cloneElement(child, {
          id: inputId,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${inputId}-error` : undefined,
          onChange: (...args) => { clearError?.(name); child.props.onChange?.(...args) },
        })
      }
      if (child.type === 'label') return cloneElement(child, { htmlFor: inputId })
      return child
    })
    const props = { key: name || field.key, 'data-field': name,
      className: `${field.props.className || ''} form-field ${['address', 'notes', 'other'].includes(name) ? 'full' : ''}` }
    const message = error && <p className="form-field-error" id={`${inputId}-error`} role="alert">{error}</p>
    // Keep error text outside labels so it does not change the control's name.
    const { key, ...attributes } = props
    return field.type === 'label'
      ? <div key={key} {...attributes}>{cloneElement(field, { htmlFor: inputId, className: undefined }, content)}{message}</div>
      : cloneElement(field, props, content, message)
  }
  return <>
    {groups[kind].map(([title, names]) => {
      const section = fields.filter(field => names.includes(fieldName(field)))
      section.forEach(field => assigned.add(field))
      return section.length ? <section className="form-section" key={title} aria-label={title}>
        <h3>{title}</h3><div className="form-fields-grid">{section.map(renderField)}</div>
      </section> : null
    })}
    {fields.filter(field => !assigned.has(field) && !(field.type === 'p' && field.props.className?.includes('sales-exec-section'))).map(field =>
      controlOf(field) ? renderField(field) : field)}
  </>
}

export function FormActions({ busy, onCancel, form, label = 'Save Changes', disabled = false }) {
  return <footer className="form-dialog-footer">
    <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
    <button type="submit" form={form} className="btn btn-primary" disabled={busy || disabled}>{busy ? 'Saving...' : label}</button>
  </footer>
}
