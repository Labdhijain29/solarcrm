import EnquiryForm from '../website/EnquiryForm'
import { useId, useState } from 'react'
import { FormActions } from '../common/FormLayout'
import { useFormExit } from '../../hooks/useFormEditing'

export default function EnquiryFormModal({ onClose, onSubmitted }) {
  const [state, setState] = useState({ dirty: false, busy: false, sent: false })
  const id = useId()
  const requestExit = useFormExit(state.dirty, state.busy)
  const close = () => requestExit(onClose)
  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && close()}>
      <div className="modal-box form-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <div className="form-dialog-header">
          <div>
            <h2 id={`${id}-title`} style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>Create Enquiry</h2>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>Submitted enquiries will appear in the Enquiry Dashboard.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={state.busy} onClick={close}>Close</button>
        </div>
        <EnquiryForm compact onSubmitted={onSubmitted} onStateChange={setState} formId={id} />
        {!state.sent && <FormActions busy={state.busy} onCancel={close} form={id} label="Submit Enquiry" />}
      </div>
    </div>
  )
}
