import { isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaCheck, FaSearch, FaTimes } from 'react-icons/fa'
import { STAGES, stageColor, stageIndex, STATUS_BADGE } from '../../utils/constants'
export { default as FilePreview } from './FilePreview'

export function PipelineBar({ lead }) {
  const ci = stageIndex(lead.currentStage)
  return (
    <div>
      <div className="pipeline-bar">
        {STAGES.map((s, i) => {
          let cls = 'pending'
          if (lead.status === 'rejected' && i === ci) cls = 'rejected'
          else if (i < ci || (i === ci && lead.status === 'completed')) cls = 'done'
          else if (i === ci) cls = 'active'
          return <div key={s} className={`pipe-step ${cls}`} title={s} />
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>
        <span>{STAGES[0]}</span>
        <span style={{ fontWeight: 600, color: stageColor(lead.currentStage) }}>{lead.currentStage}</span>
        <span>{STAGES[STAGES.length - 1]}</span>
      </div>
    </div>
  )
}

export function StageProgress({ lead }) {
  const ci = stageIndex(lead.currentStage)
  return (
    <div className="stage-progress">
      {STAGES.map((s, i) => {
        let cls = 'pending'
        if (lead.status === 'rejected' && i === ci) cls = 'rejected'
        else if (i < ci || (i === ci && lead.status === 'completed')) cls = 'done'
        else if (i === ci) cls = 'active'
        return (
          <div key={s} className="sp-item">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className={`sp-dot ${cls}`}>
                {cls === 'done' ? <FaCheck size={10} /> : cls === 'rejected' ? <FaTimes size={10} /> : i + 1}
              </div>
              <div style={{ fontSize: 8, color: 'var(--dim)', textAlign: 'center', marginTop: 3, maxWidth: 44 }}>
                {s.split(' ')[0]}
              </div>
            </div>
            {i < STAGES.length - 1 && <div className={`sp-line ${i < ci ? 'done' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_BADGE[status] || 'badge-gray'}`}>{status}</span>
}

export function StageBadge({ stage }) {
  const color = stageColor(stage)
  return (
    <span className="badge" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {stage}
    </span>
  )
}

export function LeadAvatar({ name, size = 36 }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  const hue = name?.charCodeAt(0) * 37 % 360 || 200
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 3,
      background: `hsl(${hue},50%,30%)`,
      border: `1px solid hsl(${hue},40%,40%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Syne,sans-serif', fontWeight: 700,
      fontSize: size * 0.35, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export function MetricCard({ icon, label, value, change, changeColor, onClick }) {
  const isElement = isValidElement(icon)
  const Component = onClick ? 'button' : 'div'
  return (
    <Component type={onClick ? 'button' : undefined} className={`metric-card ${onClick ? 'metric-card-clickable' : ''}`} onClick={onClick}>
      {!isElement && <div style={{ position: 'absolute', right: -8, top: -8, fontSize: 72, opacity: .05 }}>{icon}</div>}
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(245,158,11,.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>
        {icon}
      </div>
      <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
      {change && (
        <div style={{ fontSize: 12, marginTop: 6, color: changeColor || 'var(--muted)' }}>{change}</div>
      )}
    </Component>
  )
}

export function EmptyState({ icon = <FaSearch />, title = 'No results', subtitle = 'Try adjusting your filters' }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 48, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: 13 }}>{subtitle}</div>
    </div>
  )
}

export function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  noOptionsText = 'No options available',
  disabled = false,
  required = false,
  name,
}) {
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuStyle, setMenuStyle] = useState(null)
  const selectedOption = options.find((option) => option.value === value) || null

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) => String(option.label || '').toLowerCase().includes(normalizedQuery))
  }, [options, query])

  const [highlightedIndex, setHighlightedIndex] = useState(() => {
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value)
    return selectedIndex >= 0 ? selectedIndex : 0
  })

  useEffect(() => {
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [filteredOptions, value])

  useEffect(() => {
    if (!open) return

    const updateMenuPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const placeAbove = spaceBelow < 220 && spaceAbove > spaceBelow
      const menuMaxHeight = Math.max(140, Math.min(320, placeAbove ? spaceAbove : spaceBelow))
      const menuTop = placeAbove
        ? Math.max(12, rect.top - menuMaxHeight - 6)
        : rect.bottom + 6

      setMenuStyle({
        top: menuTop,
        left: rect.left,
        width: rect.width,
        maxHeight: menuMaxHeight,
      })
    }

    updateMenuPosition()
    inputRef.current?.focus()

    const handlePointerDown = (event) => {
      const clickedInsideTrigger = rootRef.current?.contains(event.target)
      const clickedInsideMenu = menuRef.current?.contains(event.target)

      if (!clickedInsideTrigger && !clickedInsideMenu) {
        setOpen(false)
        setQuery('')
      }
    }

    const handleViewportChange = () => updateMenuPosition()

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [open, filteredOptions.length])

  const commitSelection = (nextValue) => {
    onChange?.(nextValue)
    setOpen(false)
    setQuery('')
  }

  const openDropdown = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openDropdown()
      return
    }

    if (!open) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setQuery('')
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
      return
    }

    if (event.key === 'Enter' && filteredOptions[highlightedIndex]) {
      event.preventDefault()
      commitSelection(filteredOptions[highlightedIndex].value)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`searchable-select ${disabled ? 'is-disabled' : ''}`}
      onKeyDown={handleKeyDown}
    >
      <input
        tabIndex={-1}
        aria-hidden="true"
        readOnly
        name={name}
        required={required}
        value={value}
        className="searchable-select-hidden"
      />
      <button
        type="button"
        ref={triggerRef}
        className={`crm-input searchable-select-trigger ${open ? 'is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className={`searchable-select-trigger-label ${selectedOption ? '' : 'is-placeholder'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="searchable-select-caret">v</span>
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          className="searchable-select-menu"
          style={{
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
            maxHeight: menuStyle.maxHeight,
          }}
        >
          <div className="searchable-select-search">
            <FaSearch size={12} />
            <input
              ref={inputRef}
              className="crm-input searchable-select-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          <div
            id={listId}
            className="searchable-select-options"
            role="listbox"
            style={{ maxHeight: Math.max(88, menuStyle.maxHeight - 62) }}
          >
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-empty">{noOptionsText}</div>
            ) : (
              filteredOptions.map((option, index) => {
                const selected = option.value === value
                const highlighted = index === highlightedIndex
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`searchable-select-option ${selected ? 'is-selected' : ''} ${highlighted ? 'is-highlighted' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => commitSelection(option.value)}
                    role="option"
                    aria-selected={selected}
                  >
                    <span>{option.label}</span>
                    {selected && <FaCheck size={12} />}
                  </button>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export function Spinner({ size = 32 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        width: size, height: size,
        border: '3px solid var(--border)',
        borderTop: '3px solid var(--sun)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function PageHeader({ icon, title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          {icon && <span style={{ fontSize: 28, display: 'flex', alignItems: 'center' }}>{icon}</span>}
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800 }}>{title}</h1>
        </div>
        {subtitle && <p style={{ color: 'var(--muted)', fontSize: 13 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionTag({ children }) {
  return (
    <div style={{ display: 'inline-block', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', color: 'var(--sun)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, padding: '4px 12px', borderRadius: 20, marginBottom: 12 }}>
      {children}
    </div>
  )
}
