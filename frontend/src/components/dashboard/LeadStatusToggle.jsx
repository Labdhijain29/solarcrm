import { useRef, useState } from 'react'
import { FaExchangeAlt, FaPauseCircle, FaPlayCircle } from 'react-icons/fa'
import Swal from 'sweetalert2'
import toast from 'react-hot-toast'
import { leadsAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { ROLE_STAGE_MAP } from '../../utils/constants'
import { StatusBadge } from '../common'

export const HOLD_STAGES = ['Name Change', 'Registration', 'Bank Approval', 'Loan Disbursement', 'Dispatch', 'Installation']
export const HOLD_STATUS_OPTIONS = [{ value: 'active', label: 'Active' }, { value: 'on-hold', label: 'On Hold' }, { value: 'All', label: 'All' }]
export const canToggleLeadHold = (user, lead) => HOLD_STAGES.includes(lead.currentStage) && ['active', 'on-hold'].includes(lead.status) && (
  user?.role === 'Admin' || (ROLE_STAGE_MAP[user?.role] === lead.currentStage && String(lead.assignedTo?._id || lead.assignedTo || '') === String(user?._id))
)

export default function LeadStatusToggle({ lead, onUpdated }) {
  const { user } = useAuthStore()
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  if (!canToggleLeadHold(user, lead)) return <StatusBadge status={lead.status} />
  const held = lead.status === 'on-hold'
  const changeStatus = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try {
      const result = await Swal.fire({
        titleText: held ? 'Resume this lead?' : 'Put this lead on hold?',
        text: `${lead.name} will ${held ? 'become Active' : 'stay at this stage until resumed'}.`,
        icon: 'question', input: 'textarea', inputLabel: 'Reason (optional)', inputPlaceholder: 'Add a note for the team...',
        inputAttributes: { maxlength: '2000' }, width: 480,
        showCancelButton: true, confirmButtonText: held ? 'Resume Lead' : 'Confirm Hold', cancelButtonText: 'Cancel',
        confirmButtonColor: held ? '#059669' : '#d97706', cancelButtonColor: '#475569',
        background: 'var(--card)', color: 'var(--text)', customClass: { popup: 'lead-status-swal' },
        reverseButtons: true, focusCancel: true, showLoaderOnConfirm: true,
        allowOutsideClick: () => !Swal.isLoading(), allowEscapeKey: () => !Swal.isLoading(),
        preConfirm: async reason => {
          try { return (await leadsAPI.setStatus(lead._id, { status: held ? 'active' : 'on-hold', stage: lead.currentStage, note: String(reason || '').trim() })).data }
          catch (error) { Swal.showValidationMessage(error.response?.data?.message || 'Could not update the lead. Please try again.'); return false }
        },
      })
      if (result.isConfirmed && result.value) {
        toast.success(result.value.message || (held ? 'Lead resumed.' : 'Lead put on hold.'))
        onUpdated?.()
      }
    } finally { pending.current = false; setBusy(false) }
  }
  const Icon = held ? FaPauseCircle : FaPlayCircle
  return <button type="button" className={`lead-status-toggle ${held ? 'is-held' : 'is-active'}`} disabled={busy}
    onClick={changeStatus} title={held ? 'Click to resume this lead' : 'Click to put this lead on hold'}
    aria-label={`${held ? 'Resume' : 'Put on hold'}: ${lead.name}`}>
    <Icon aria-hidden="true" /><span>{held ? 'On Hold' : 'Active'}</span><FaExchangeAlt className="lead-status-toggle-hint" aria-hidden="true" />
  </button>
}
