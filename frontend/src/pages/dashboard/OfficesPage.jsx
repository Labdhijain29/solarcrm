import OfficeSortableList from '../../components/dashboard/OfficeSortableList'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { officesAPI } from '../../services/api'
import { FaPlus, FaRegBuilding, FaPen } from 'react-icons/fa'
import { PageHeader, SearchableSelect } from '../../components/common'
import { STATE_OPTIONS, getCitiesForState } from '../../utils/constants'
import { useFormExit } from '../../hooks/useFormEditing'

const empty = { name:'', code:'', address:'', state:'', city:'', pincode:'', phone:'', email:'', isActive:true }

export function OfficeEditor({ onSaved, onStateChange, onCancel, locked = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [baseline, setBaseline] = useState(empty)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)
  const requestExit = useFormExit(dirty, saving)
  useEffect(() => { onStateChange?.({ dirty, saving }) }, [dirty, saving, onStateChange])
  useEffect(() => {
    if (!id) return
    officesAPI.getOne(id).then(response => { const data = Object.fromEntries(Object.keys(empty).map(key => [key, response.data.data[key] ?? empty[key]])); setForm(data); setBaseline(data) }).catch(error => setError(error.response?.data?.message || 'Unable to load office.')).finally(() => setLoading(false))
  }, [id])
  const set = (key, value) => setForm(previous => ({ ...previous, [key]:value, ...(key === 'state' ? { city:'' } : {}) }))
  const save = async event => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try { await (id ? officesAPI.update(id, form) : officesAPI.create(form)); toast.success('Office saved.'); window.dispatchEvent(new Event('solar-offices-updated')); if (onSaved) onSaved(); else navigate('/dashboard/offices') } catch (error) { toast.error(error.response?.data?.message || 'Unable to save office.') } finally { setSaving(false) }
  }
  if (loading) return <p>Loading office…</p>
  if (error) return <p role="alert">{error}</p>
  return <div className="crm-card office-editor"><div className="office-editor-heading"><span className="office-editor-icon"><FaRegBuilding /></span><div><h2>{id ? 'Edit Office' : 'Add Office'}</h2><p>{id ? form.name : 'Enter the new office details.'}</p></div></div><form onSubmit={save}><fieldset disabled={saving || locked} className="form-fieldset"><div className="office-form-grid">
    {[['name','Office name','text',true], ['code','Office code','text',true]].map(([key,label,type,required]) => <label key={key} className="form-label">{label}{required ? ' *' : ''}<input className="crm-input" type={type} required={required} value={form[key]} maxLength={key === 'phone' ? 10 : key === 'pincode' ? 6 : key === 'code' ? 12 : 100} onChange={event => set(key, ['phone','pincode'].includes(key) ? event.target.value.replace(/\D/g,'') : key === 'code' ? event.target.value.toUpperCase() : event.target.value)} /></label>)}
    <div><label className="form-label">Status</label><SearchableSelect name="isActive" value={form.isActive ? 'active' : 'inactive'} options={[{ value:'active', label:'Active' },{ value:'inactive', label:'Inactive' }]} onChange={value => set('isActive', value === 'active')} /></div>
    {[['phone','Contact number','tel'], ['email','Email','email'], ['pincode','Pincode','text']].map(([key,label,type,required]) => <label key={key} className="form-label">{label}{required ? ' *' : ''}<input className="crm-input" type={type} required={required} value={form[key]} maxLength={key === 'phone' ? 10 : key === 'pincode' ? 6 : key === 'code' ? 12 : 100} onChange={event => set(key, ['phone','pincode'].includes(key) ? event.target.value.replace(/\D/g,'') : key === 'code' ? event.target.value.toUpperCase() : event.target.value)} /></label>)}
    <div><label className="form-label">State</label><SearchableSelect name="state" value={form.state} options={STATE_OPTIONS.map(value => ({ value, label:value }))} onChange={value => set('state', value)} /></div>
    <div><label className="form-label">City</label><SearchableSelect name="city" value={form.city} options={getCitiesForState(form.state).map(value => ({ value, label:value }))} onChange={value => set('city', value)} disabled={!form.state} /></div>
    <label className="form-label">Address<textarea className="crm-input" rows={2} maxLength={500} value={form.address} onChange={event => set('address',event.target.value)} /></label>
  </div></fieldset><div className="office-editor-actions"><button type="button" className="btn btn-ghost" disabled={locked || saving} onClick={() => requestExit(() => onCancel ? onCancel() : navigate('/dashboard/offices'))}>Cancel</button><button className="btn btn-primary" disabled={locked || saving || (Boolean(id) && !dirty)}>{saving ? 'Saving…' : 'Save Office'}</button></div></form></div>
}

export default function OfficesPage({ onEdit, refreshKey = 0, selectedId, disabled = false, onBusyChange }) {
  const [offices, setOffices] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { officesAPI.getAll().then(response => setOffices(response.data.data)).catch(() => setError('Unable to load offices.')).finally(() => setLoading(false)) }, [refreshKey])
  if (onEdit) return <OfficeSortableList offices={offices} onChange={setOffices} onEdit={onEdit} selectedId={selectedId} disabled={disabled} loading={loading} error={error} search={search} onSearchChange={setSearch} onBusyChange={onBusyChange} />
  return <section><h1>Offices</h1>{loading ? <p>Loading offices…</p> : error ? <p role="alert">{error}</p> : <div className="office-list-grid">{offices.map(office => <article className="crm-card" key={office._id}><div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}><h3>{office.name}</h3><span className={`badge ${office.isActive ? 'badge-green' : 'badge-gray'}`}>{office.isActive ? 'Active' : 'Inactive'}</span></div><p style={{ color:'var(--muted)' }}>#{office.order || offices.indexOf(office) + 1} | {office.code} · {[office.city,office.state].filter(Boolean).join(', ') || '—'}</p>{office.address && <p>{office.address}{office.pincode ? ` · ${office.pincode}` : ''}</p>}{office.phone && <p>{office.phone}</p>}{office.email && <p>{office.email}</p>}{onEdit && <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop:14 }} onClick={() => onEdit(office._id)} aria-label={`Edit ${office.name}`}>Edit Office</button>}</article>)}</div>}</section>
}


export function OfficeManager() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [revision, setRevision] = useState(0)
  const [ordering, setOrdering] = useState(false)
  const [editor, setEditor] = useState({ dirty:false, saving:false })
  const requestExit = useFormExit(editor.dirty, editor.saving)
  const formRef = useRef(null)
  const pendingFocus = useRef(false)
  const open = officeId => requestExit(() => {
    pendingFocus.current = true
    if (officeId === id || (!officeId && !id)) setRevision(value => value + 1)
    else navigate(officeId ? `/dashboard/offices/${officeId}/edit` : '/dashboard/offices/new')
  })
  useEffect(() => {
    if (pendingFocus.current) {
      if (window.matchMedia('(max-width: 1000px)').matches) formRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })
      pendingFocus.current = false
    }
  }, [id, revision])
  const saved = () => { setRevision(value => value + 1); setEditor({ dirty:false, saving:false }); if (id) navigate('/dashboard/offices/new') }
  return <section className="office-manager">
    <PageHeader icon={<FaRegBuilding />} title="Manage Offices" subtitle="Select an office to edit its details, or add a new office." action={<button className="btn btn-primary" disabled={editor.saving || ordering} onClick={() => open(null)}><FaPlus /> Add Office</button>} />
    <div className="office-manager-layout">
      <OfficesPage refreshKey={revision} selectedId={id} disabled={editor.saving} onBusyChange={setOrdering} onEdit={officeId => open(officeId)} />
      <div className="office-manager-panel" ref={formRef}><OfficeEditor locked={ordering} key={`${id || 'new'}-${revision}`} onSaved={saved} onStateChange={setEditor} onCancel={() => { setRevision(value => value + 1); navigate('/dashboard/offices/new') }} /></div>
    </div>
  </section>
}
