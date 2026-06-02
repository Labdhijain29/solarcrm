import EnquiryForm from '../website/EnquiryForm'

export default function EnquiryFormModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:720 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700 }}>Create Enquiry</h2>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>Submitted enquiries will appear in the Enquiry Dashboard.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <EnquiryForm compact />
      </div>
    </div>
  )
}
