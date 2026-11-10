export const indiaToday = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${value.year}-${value.month}-${value.day}`
}

export const isConvertedEnquiry = (enquiry) => Boolean(enquiry.convertedTo) || enquiry.status === 'converted'

export const followUpState = (enquiry, today) => {
  if (isConvertedEnquiry(enquiry)) return 'converted'
  if (enquiry.status === 'closed') return 'closed'
  const date = enquiry.nextFollowUpDate
  if (!date) return 'none'
  if (date < today) return 'overdue'
  if (date === today) return 'today'
  return 'upcoming'
}

export const formatFollowUpDate = (value) => {
  if (!value) return 'No date set'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}
