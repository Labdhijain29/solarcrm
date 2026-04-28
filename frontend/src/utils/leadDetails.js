const extractValueFromNotes = (notes, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(notes || '').match(new RegExp(`^${escapedLabel}:\\s*(.*)$`, 'mi'))
  return match?.[1]?.trim() || ''
}

const buildSalesExecutiveDataFromNotes = (lead) => ({
  contact: lead.phone || '',
  state: lead.state || '',
  city: lead.city || '',
  addressdu: lead.address || '',
  pincode: lead.pincode || '',
  panCardNo: extractValueFromNotes(lead.notes, 'PAN'),
  aadharNo: extractValueFromNotes(lead.notes, 'Aadhar'),
  dealNo: extractValueFromNotes(lead.notes, 'Deal No'),
  brand: extractValueFromNotes(lead.notes, 'Brand'),
  accountNo: extractValueFromNotes(lead.notes, 'Account No'),
  other: extractValueFromNotes(lead.notes, 'Other Details'),
  photoOneName: extractValueFromNotes(lead.notes, 'Photo 1 File') || extractValueFromNotes(lead.notes, 'Image File'),
  photoTwoName: extractValueFromNotes(lead.notes, 'Photo 2 File'),
  documentPdfName: extractValueFromNotes(lead.notes, 'PDF File'),
})

export const getSalesExecutiveData = (lead) => {
  const data = lead?.salesExecutiveData || {}
  const hasStructuredData = Object.values(data).some((value) => String(value || '').trim())

  return hasStructuredData ? data : buildSalesExecutiveDataFromNotes(lead || {})
}

export const getLeadViewSections = (lead) => {
  const salesExecutiveData = getSalesExecutiveData(lead)
  const isSalesExecutiveLead = Array.isArray(lead?.tags) && lead.tags.includes('sales-executive')

  const overview = [
    ['ID', lead?._id?.slice(-8) || lead?.id || '-'],
    ['Customer', lead?.name || '-'],
    ['Phone', lead?.phone || '-'],
    ['Email', lead?.email || '-'],
    ['Address', lead?.address || salesExecutiveData.addressdu || '-'],
    ['City', lead?.city || salesExecutiveData.city || '-'],
    ['State', lead?.state || salesExecutiveData.state || '-'],
    ['Pincode', lead?.pincode || salesExecutiveData.pincode || '-'],
    ['IVRS No.', lead?.ivrsNo || '-'],
    ['Source', lead?.source || '-'],
    ['By / Through', lead?.generatedThrough || '-'],
    ['Capacity', lead?.capacity || '-'],
    ['Roof Type', lead?.roofType || '-'],
    ['Monthly Bill', lead?.monthlyBill ? `Rs ${Number(lead.monthlyBill).toLocaleString('en-IN')}` : '-'],
    ['Assigned To', lead?.assignedTo?.name || lead?.assignedTo || '-'],
    ['Status', lead?.status || '-'],
  ]

  const salesExecutiveFields = isSalesExecutiveLead ? [
    ['Sales Contact', salesExecutiveData.contact || lead?.phone || '-'],
    ['Deal No.', salesExecutiveData.dealNo || '-'],
    ['Brand', salesExecutiveData.brand || '-'],
    ['PAN Card No.', salesExecutiveData.panCardNo || '-'],
    ['Aadhar No.', salesExecutiveData.aadharNo || '-'],
    ['Account No.', salesExecutiveData.accountNo || '-'],
    ['Other', salesExecutiveData.other || '-'],
    ['Photo 1', salesExecutiveData.photoOneName || '-'],
    ['Photo 2', salesExecutiveData.photoTwoName || '-'],
    ['Document PDF', salesExecutiveData.documentPdfName || '-'],
  ] : []

  const stageSpecificFields = [
    ['Bank Remark', lead?.bankData?.remark || '-'],
    ['Application ID', lead?.loanData?.applicationId || '-'],
  ]

  return { overview, salesExecutiveFields, stageSpecificFields, isSalesExecutiveLead, salesExecutiveData }
}
