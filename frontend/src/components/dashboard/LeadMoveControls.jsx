import { FaArrowRight } from 'react-icons/fa'
import { useId } from 'react'
import Select from 'react-select'
import Swal from 'sweetalert2'

export async function confirmLeadMove(destination, assignee) {
  const result = await Swal.fire({
    titleText: `Move lead to ${destination}?`,
    text: assignee ? `Assigned to: ${assignee.name}` : `This lead will move to ${destination}.`,
    icon: 'question', showCancelButton: true, reverseButtons: true,
    confirmButtonText: 'Confirm Move', cancelButtonText: 'Cancel',
    confirmButtonColor: '#059669', background: 'var(--card)', color: 'var(--text)',
    customClass: { popup: 'lead-status-swal' }, focusCancel: true,
  })
  return result.isConfirmed
}

export async function confirmLeadReject(name) {
  const result = await Swal.fire({
    titleText: 'Reject this lead?', text: `Reject ${name}?`, icon: 'warning',
    showCancelButton: true, reverseButtons: true, focusCancel: true,
    confirmButtonText: 'Reject Lead', cancelButtonText: 'Cancel', confirmButtonColor: '#dc2626',
    background: 'var(--card)', color: 'var(--text)', customClass: { popup: 'lead-status-swal' },
  })
  return result.isConfirmed
}

export default function LeadMoveControls({ canApprove, canChooseStage, targetStage, onStageChange, destination, role, users, loadingUsers, assigneeId, onAssigneeChange, busy, onMove, children }) {
  const id = useId()
  const options = users.map(user => ({ value: user._id, label: user.name }))
  const missingExecutive = Boolean(role) && users.length === 0
  return (
    <div className="lead-workflow-controls">
      {canApprove && (
        <div className="lead-move-panel">
          <div className="lead-move-fields">
            <div className="lead-move-destination">
              <span className="form-label">Move to</span>
              {canChooseStage ? (
                <div className="lead-stage-choices" role="group" aria-label="Move lead to">
                  {['Registration', 'Name Change'].map(stage => (
                    <button key={stage} type="button" className={`btn ${targetStage === stage ? 'btn-secondary' : 'btn-ghost'}`} aria-pressed={targetStage === stage} disabled={busy} onClick={() => onStageChange(stage)}>{stage}</button>
                  ))}
                </div>
              ) : <div className="lead-move-stage">{destination}</div>}
            </div>
          </div>
          <div className="lead-move-transfer">
            {role && (
              <div className="lead-move-assignee">
                <label className="form-label" htmlFor={id}>Executive</label>
                <Select inputId={id} options={options} value={options.find(option => option.value === assigneeId) || null}
                  onChange={option => onAssigneeChange(option?.value || '')} isDisabled={busy || loadingUsers || missingExecutive}
                  placeholder={loadingUsers ? 'Loading executives...' : 'Select executive...'} isLoading={loadingUsers} isSearchable menuPortalTarget={document.body} menuPosition="fixed"
                  styles={{
                    control: (base, state) => ({ ...base, minHeight: 40, fontSize: 14, background: 'var(--card)', borderColor: state.isFocused ? 'var(--sun)' : 'var(--border)', boxShadow: 'none', borderRadius: 8 }),
                    singleValue: base => ({ ...base, color: 'var(--text)' }),
                    input: base => ({ ...base, color: 'var(--text)' }),
                    menu: base => ({ ...base, background: 'var(--card)', color: 'var(--text)' }),
                    option: (base, state) => ({ ...base, background: state.isSelected ? 'var(--card2)' : state.isFocused ? 'var(--bg3)' : 'var(--card)', color: 'var(--text)' }),
                    placeholder: base => ({ ...base, color: 'var(--dim)' }),
                    indicatorSeparator: base => ({ ...base, display: 'none' }),
                    dropdownIndicator: base => ({ ...base, color: 'var(--muted)' }),
                    menuPortal: base => ({ ...base, zIndex: 10000 }),
                  }} />
                {missingExecutive && !loadingUsers && <p className="lead-move-unavailable" role="status">No active {role} available. Ask Admin to add one.</p>}
              </div>
            )}
          <div className="lead-move-submit">
            <button type="button" className="btn btn-success" disabled={busy || loadingUsers || (Boolean(role) && !assigneeId) || missingExecutive} onClick={onMove}><span>{busy ? 'Please wait...' : destination === 'Completed' ? 'Complete Lead' : `Move to ${destination}`}</span>{!busy && <FaArrowRight aria-hidden="true" />}</button>
          </div>
          </div>
        </div>
      )}
      <div className="lead-secondary-actions">{children}</div>
    </div>
  )
}
