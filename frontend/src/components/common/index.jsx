import { STAGES, stageColor, stageIndex, STATUS_BADGE } from '../../utils/constants'

// ─── Pipeline Bar ────────────────────────────────────────────
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
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--dim)', marginTop:2 }}>
        <span>{STAGES[0]}</span>
        <span style={{ fontWeight:600, color: stageColor(lead.currentStage) }}>{lead.currentStage}</span>
        <span>{STAGES[STAGES.length-1]}</span>
      </div>
    </div>
  )
}

// ─── Stage Progress Steps ─────────────────────────────────────
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
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div className={`sp-dot ${cls}`}>
                {cls === 'done' ? '✓' : cls === 'rejected' ? '✗' : i + 1}
              </div>
              <div style={{ fontSize:8, color:'var(--dim)', textAlign:'center', marginTop:3, maxWidth:44 }}>
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

// ─── Status Badge ────────────────────────────────────────────
export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_BADGE[status] || 'badge-gray'}`}>{status}</span>
}

// ─── Stage Badge ─────────────────────────────────────────────
export function StageBadge({ stage }) {
  const color = stageColor(stage)
  return (
    <span className="badge" style={{ background:`${color}18`, color, border:`1px solid ${color}30` }}>
      {stage}
    </span>
  )
}

// ─── Lead Avatar ─────────────────────────────────────────────
export function LeadAvatar({ name, size = 36 }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  const hue = name?.charCodeAt(0) * 37 % 360 || 200
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 3,
      background: `hsl(${hue},50%,30%)`,
      border: `1px solid hsl(${hue},40%,40%)`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Syne,sans-serif', fontWeight:700,
      fontSize: size * 0.35, color:'#fff', flexShrink:0
    }}>
      {initials}
    </div>
  )
}

// ─── Metric Card ─────────────────────────────────────────────
export function MetricCard({ icon, label, value, change, changeColor }) {
  return (
    <div className="metric-card">
      <div style={{ position:'absolute', right:-8, top:-8, fontSize:72, opacity:.05 }}>{icon}</div>
      <div style={{ width:44, height:44, borderRadius:12, background:`rgba(245,158,11,.1)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, marginBottom:12 }}>
        {icon}
      </div>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:700, color:'var(--text)' }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{label}</div>
      {change && (
        <div style={{ fontSize:12, marginTop:6, color: changeColor || 'var(--muted)' }}>{change}</div>
      )}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────
export function EmptyState({ icon = '🔍', title = 'No results', subtitle = 'Try adjusting your filters' }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px', color:'var(--muted)' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:500, marginBottom:6, color:'var(--text)' }}>{title}</div>
      <div style={{ fontSize:13 }}>{subtitle}</div>
    </div>
  )
}

// ─── Loading Spinner ─────────────────────────────────────────
export function Spinner({ size = 32 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{
        width: size, height: size,
        border: '3px solid var(--border)',
        borderTop: '3px solid var(--sun)',
        borderRadius:'50%',
        animation:'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── Page Header ─────────────────────────────────────────────
export function PageHeader({ icon, title, subtitle, action }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
          {icon && <span style={{ fontSize:28 }}>{icon}</span>}
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800 }}>{title}</h1>
        </div>
        {subtitle && <p style={{ color:'var(--muted)', fontSize:13 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Section Tag ─────────────────────────────────────────────
export function SectionTag({ children }) {
  return (
    <div style={{ display:'inline-block', background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.2)', color:'var(--sun)', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:1, padding:'4px 12px', borderRadius:20, marginBottom:12 }}>
      {children}
    </div>
  )
}
