import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import { FaGripVertical, FaPen } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { officesAPI } from '../../services/api'

function OfficeRow({ office, position, selected, disabled, canDrag, active, marker, onEdit, onStart, onEnd, onPointerMove, onKeyDown }) {
  const controls = useDragControls()
  const reducedMotion = useReducedMotion()
  return <Reorder.Item value={office} dragListener={false} dragControls={controls} drag={canDrag ? 'y' : false} dragMomentum={false} layout="position" transition={{ duration:reducedMotion ? 0 : .18 }} onDragStart={(_event,info) => onStart(office._id, 'pointer',info.point)} onDrag={onPointerMove} onDragEnd={(event,info) => onEnd(event.type === 'pointercancel',info.point)} className={`office-sortable-item ${active ? 'is-dragging' : ''} ${marker || ''}`}>
    <button type="button" className="office-drag-handle" aria-label={`Reorder ${office.name}`} aria-describedby="office-drag-help" aria-pressed={active} disabled={!canDrag} onPointerDown={event => { if (event.button === 0) controls.start(event) }} onKeyDown={event => onKeyDown(event, office._id)}><FaGripVertical /></button>
    <button type="button" disabled={disabled} className={`office-manager-row ${selected ? 'is-selected' : ''}`} aria-label={`Edit ${office.name}`} aria-current={selected ? 'true' : undefined} onClick={() => onEdit(office._id)}>
      <span className="office-row-title"><strong><span className="office-order-number">{position}</span>{office.name}</strong><FaPen aria-hidden="true" /></span>
      <span className="office-row-meta">{[office.code,office.city].filter(Boolean).join(' | ')}</span>
      <span className={`office-row-status ${office.isActive ? 'is-active' : ''}`}><i />{office.isActive ? 'Active' : 'Inactive'}</span>
    </button>
  </Reorder.Item>
}

export default function OfficeSortableList({ offices, onChange, onEdit, selectedId, disabled, loading, error, search, onSearchChange, onBusyChange }) {
  const [active, setActive] = useState(null)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [point, setPoint] = useState(null)
  const current = useRef(offices)
  const snapshot = useRef([])
  const drag = useRef(null)
  const pending = useRef(false)
  const list = useRef(null)
  const pointerY = useRef(null)
  const cancelled = useRef(false)
  current.current = offices
  useEffect(() => { onBusyChange?.(saving || Boolean(active)) }, [saving, active, onBusyChange])
  const replace = values => { current.current = values; onChange(values) }
  const begin = (id, mode, initialPoint) => {
    if (pending.current || disabled || search.trim() || drag.current) return
    snapshot.current = [...current.current]
    drag.current = { id, mode }; cancelled.current = false; setActive({ id, mode })
    if (initialPoint) setPoint({ x:initialPoint.x - window.scrollX, y:initialPoint.y - window.scrollY })
    setAnnouncement(`${current.current.find(item => item._id === id)?.name} picked up.`)
  }
  const cancel = () => {
    if (!drag.current) return
    replace(snapshot.current); drag.current = null; cancelled.current = true; pointerY.current = null; setActive(null)
    setAnnouncement('Reordering cancelled.')
  }
  useEffect(() => {
    if (!active) return
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); cancel() } }
    const blur = () => cancel()
    window.addEventListener('keydown', escape); window.addEventListener('blur', blur)
    let frame
    const scroll = () => {
      if (drag.current?.mode === 'pointer' && pointerY.current !== null && list.current) {
        const bounds = list.current.getBoundingClientRect(), y = pointerY.current
        const delta = y < bounds.top + 45 ? -10 : y > bounds.bottom - 45 ? 10 : 0
        if (delta) list.current.scrollTop += delta
      }
      frame = requestAnimationFrame(scroll)
    }
    frame = requestAnimationFrame(scroll)
    return () => { window.removeEventListener('keydown', escape); window.removeEventListener('blur', blur); cancelAnimationFrame(frame) }
  }, [active])
  const finish = async (wasCancelled, endPoint) => {
    if (endPoint && list.current) {
      const bounds = list.current.getBoundingClientRect(), x = endPoint.x - window.scrollX, y = endPoint.y - window.scrollY
      if (x < bounds.left || x > bounds.right || y < bounds.top - 16 || y > bounds.bottom + 16) wasCancelled = true
    }
    if (wasCancelled) return cancel()
    const item = drag.current
    if (!item || cancelled.current || pending.current) return
    drag.current = null; pointerY.current = null; setActive(null)
    const before = snapshot.current.map(office => office._id), after = current.current.map(office => office._id)
    if (before.every((id,index) => after[index] === id)) { setAnnouncement('Office position unchanged.'); return }
    pending.current = true; setSaving(true); setAnnouncement('Saving office order...')
    try {
      await officesAPI.update(item.id, { order:after.indexOf(item.id) + 1, expectedOrder:before })
      const response = await officesAPI.getAll()
      replace(response.data.data)
      window.dispatchEvent(new Event('solar-offices-updated'))
      toast.success('Office order updated.'); setAnnouncement('Office order updated.')
    } catch (error) {
      replace(snapshot.current)
      // A timeout may occur after a committed save. Reload the authoritative order.
      try { const response = await officesAPI.getAll(); replace(response.data.data) } catch { /* Keep the previous order; retry remains available. */ }
      const message = error.response?.data?.message || 'Could not update office order. Please try again.'
      toast.error(message); setAnnouncement(message)
    } finally { pending.current = false; setSaving(false) }
  }
  const keyboard = (event, id) => {
    if ([' ', 'Enter'].includes(event.key)) {
      event.preventDefault()
      if (drag.current?.mode === 'keyboard') finish(false)
      else if (!drag.current) begin(id, 'keyboard')
    } else if (event.key === 'Escape' && drag.current?.mode === 'keyboard') { event.preventDefault(); cancel() }
    else if (['ArrowUp','ArrowDown','Home','End'].includes(event.key) && drag.current?.id === id && drag.current.mode === 'keyboard') {
      event.preventDefault()
      const values = [...current.current], from = values.findIndex(item => item._id === id)
      const to = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : Math.max(0,Math.min(values.length - 1, from + (event.key === 'ArrowUp' ? -1 : 1)))
      const [office] = values.splice(from,1); values.splice(to,0,office); replace(values)
      setAnnouncement(`${office.name}, position ${to + 1} of ${values.length}.`)
      requestAnimationFrame(() => list.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block:'nearest' }))
    } else if (event.key === 'Tab' && drag.current?.mode === 'keyboard') cancel()
  }
  const visible = offices.filter(office => [office.name,office.code,office.city].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  const activeIndex = offices.findIndex(item => item._id === active?.id)
  const draggedOffice = offices[activeIndex]
  const previewBounds = list.current?.getBoundingClientRect()
  return <aside className="crm-card office-manager-list" aria-label="Office list">
    <div className="office-list-heading"><h2>Offices</h2><span>{offices.length}</span></div>
    <input className="crm-input office-search" aria-label="Search offices" placeholder="Search offices..." value={search} disabled={saving || Boolean(active)} onChange={event => onSearchChange(event.target.value)} />
    <p className="office-drag-caption">{saving ? 'Saving order...' : active ? active.mode === 'keyboard' ? 'Arrow keys to move. Space to save.' : 'Release to save.' : search.trim() ? 'Clear search to reorder.' : 'Drag the handle to reorder.'}</p>
    <p id="office-drag-help" className="office-drag-help">Press Space to pick up, arrow keys to move, Space to save, or Escape to cancel.</p>
    <span className="office-drag-help" role="status" aria-live="polite">{announcement}</span>
    {loading ? <p className="office-list-message">Loading offices...</p> : error ? <p className="office-list-message" role="alert">{error}</p> : !visible.length ? <p className="office-list-message">{search ? 'No offices match your search.' : 'No offices yet.'}</p> : <Reorder.Group data-drag-mode={active?.mode || ''} ref={list} axis="y" values={offices} onReorder={values => { if (drag.current && !cancelled.current) replace(values) }} layoutScroll className="office-manager-rows office-sortable-list" aria-label="Office order" aria-busy={saving}>
      {visible.map(office => {
        const index = offices.indexOf(office), isActive = active?.id === office._id
        const marker = active && activeIndex !== index ? index === activeIndex + 1 ? 'drop-before' : activeIndex === offices.length - 1 && index === activeIndex - 1 ? 'drop-after' : '' : ''
        return <OfficeRow key={office._id} office={office} position={index + 1} selected={selectedId === office._id} disabled={disabled || saving || Boolean(active)} canDrag={!disabled && !saving && !search.trim() && offices.length > 1 && (!active || isActive)} active={isActive} marker={marker} onEdit={onEdit} onStart={begin} onEnd={finish} onPointerMove={(_event, info) => { pointerY.current = info.point.y - window.scrollY; setPoint({ x:info.point.x - window.scrollX,y:pointerY.current }) }} onKeyDown={keyboard} />
      })}
    </Reorder.Group>}
    {active?.mode === 'pointer' && point && draggedOffice && previewBounds && createPortal(<div aria-hidden="true" className="office-drag-preview" style={{ top:Math.max(8,Math.min(window.innerHeight - 112,point.y - 48)),left:previewBounds.left,width:previewBounds.width }}><FaGripVertical /><div><strong>{draggedOffice.name}</strong><span>{[draggedOffice.code,draggedOffice.city].filter(Boolean).join(' | ')}</span><small>Position {activeIndex + 1}</small></div></div>, document.body)}
  </aside>
}
