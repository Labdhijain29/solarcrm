import Swal from 'sweetalert2'
import { serviceRequestsAPI } from '../services/api'

export const SERVICE_STATUS_LABELS = { pending: 'Pending', 'on-hold': 'On Hold', completed: 'Completed' }

export async function requestServiceStatusChange(request, { initialStatus = '', onConflict } = {}) {
  const choices = request.status === 'completed' ? ['pending'] : request.status === 'on-hold' ? ['pending', 'completed'] : ['on-hold', 'completed']
  const selected = choices.includes(initialStatus) ? initialStatus : request.status === 'pending' ? 'completed' : 'pending'
  const noteLabel = status => status === 'completed' ? 'Completion note (required)' : 'Reason (optional)'
  const result = await Swal.fire({
    titleText: `Update status - ${request.requestNo}`,
    html: `<fieldset class="service-status-choices"><legend>Choose status</legend>${choices.map(status => `<label class="service-status-choice ${selected === status ? 'selected' : ''}"><input type="radio" name="service-status-target" value="${status}" ${selected === status ? 'checked' : ''}><span>${request.status === 'completed' ? 'Reopen as Pending' : SERVICE_STATUS_LABELS[status]}</span></label>`).join('')}</fieldset>`,
    input: 'textarea', inputLabel: noteLabel(selected), inputPlaceholder: 'Add a note...', inputAttributes: { maxlength: '3000' },
    showCancelButton: true, reverseButtons: true, focusCancel: true,
    confirmButtonText: 'Save Status', cancelButtonText: 'Cancel',
    confirmButtonColor: '#059669', cancelButtonColor: '#475569', width: 480,
    background: 'var(--card)', color: 'var(--text)', customClass: { popup: 'lead-status-swal service-status-swal' },
    showLoaderOnConfirm: true, allowOutsideClick: () => !Swal.isLoading(), allowEscapeKey: () => !Swal.isLoading(),
    didOpen: () => {
      const popup = Swal.getPopup()
      popup.querySelector('.service-status-choices').addEventListener('change', event => {
        Swal.resetValidationMessage()
        popup.querySelector('.swal2-input-label').textContent = noteLabel(event.target.value)
        popup.querySelectorAll('.service-status-choice').forEach(label => label.classList.toggle('selected', label.querySelector('input').checked))
      })
      Swal.getInput().addEventListener('input', () => Swal.resetValidationMessage())
    },
    preConfirm: async note => {
      const status = Swal.getPopup().querySelector('input[name="service-status-target"]:checked')?.value
      if (!status) { Swal.showValidationMessage('Select a new status.'); return false }
      if (status === 'completed' && !note.trim()) { Swal.showValidationMessage('A completion note is required.'); return false }
      try { return (await serviceRequestsAPI.setStatus(request._id, { status, currentStatus: request.status, note: note.trim() })).data }
      catch (error) {
        Swal.showValidationMessage(error.response?.status === 409 ? 'This request changed. Cancel and reopen the status selector to try again.' : error.response?.data?.message || 'Could not change status. Please try again.')
        if (error.response?.status === 409) onConflict?.()
        return false
      }
    },
  })
  return result.isConfirmed ? result.value : null
}
