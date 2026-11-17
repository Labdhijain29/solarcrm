import { FaCheckCircle, FaExchangeAlt, FaPauseCircle, FaPlayCircle } from 'react-icons/fa'
import { SERVICE_STATUS_LABELS } from '../../utils/serviceRequestStatus'

export default function ServiceStatusControl({ request, disabled, onClick }) {
  const held = request.status === 'on-hold'
  const Icon = held ? FaPauseCircle : request.status === 'completed' ? FaCheckCircle : FaPlayCircle
  return <button type="button" className={`lead-status-toggle service-status-toggle ${held ? 'is-held' : 'is-active'}`}
    disabled={disabled} onClick={onClick} title="Click to change status" aria-label={`Change status for ${request.requestNo}`}>
    <Icon aria-hidden="true" /><span>{SERVICE_STATUS_LABELS[request.status]}</span><FaExchangeAlt className="lead-status-toggle-hint" aria-hidden="true" />
  </button>
}
