import { createContext, useContext, useEffect, useState } from 'react'
import { officesAPI } from '../../services/api'
import { useAuthStore } from '../../store'
import { SearchableSelect } from '../common'
import Swal from 'sweetalert2'
import { FaChevronDown, FaRegBuilding } from 'react-icons/fa'

const OfficeContext = createContext({ offices:[], selected:'' })
export const useOfficeContext = () => useContext(OfficeContext)

function OfficeCardContent({ name }) {
  return <>
    <span className="office-name-icon" aria-hidden="true"><FaRegBuilding /></span>
    <span className="office-name-text"><span className="office-name-label">Current office</span><strong className="office-name-value" title={name}>{name}</strong></span>
  </>
}

export function OfficeSelector() {
  const { offices, selected } = useOfficeContext()
  const user = useAuthStore(state => state.user)
  const officeName = offices.find(item => item._id === selected)?.name || 'Office'
  if (user.role !== 'Admin') return <div className="office-name" role="group" aria-label="Current office" title={officeName}>
    <OfficeCardContent name={officeName} />
  </div>
  const change = async value => {
    if (!value || value === selected) return
    const answer = await Swal.fire({ title: 'Switch office?', text: 'Change to the selected office and continue?', icon: 'question', showCancelButton: true, confirmButtonText: 'Switch Office', cancelButtonText: 'Stay Here', background: 'var(--card)', color: 'var(--text)', confirmButtonColor: '#059669' })
    if (!answer.isConfirmed) return
    localStorage.setItem(`solar_office_${user._id}`, value)
    localStorage.setItem('solar_office', value)
    // A new document clears every dashboard cache, portal, modal and old request.
    window.location.assign('/dashboard')
  }
  return <div className="office-selector"><SearchableSelect name="selectedOffice" value={selected} options={offices.map(item => ({ value: item._id, label: `${item.name}${item.isActive === false ? ' (Inactive)' : ''}` }))} onChange={change} placeholder="Select office" searchPlaceholder="Search offices..." triggerClassName="office-name office-switch-trigger" renderValue={option => <OfficeCardContent name={option?.label || officeName} />} caret={<FaChevronDown />} required /></div>
}

export default function OfficeBoundary({ children }) {
  const user = useAuthStore(state => state.user)
  const [state, setState] = useState({ loading: true, offices: [], selected: '', error: '' })
  useEffect(() => {
    let mounted = true
    const refresh = () => {
      const load = user.role === 'Admin' ? officesAPI.getAll() : officesAPI.getPublic()
      load.then(response => {
        if (!mounted) return
        setState(previous => {
          window.solarOfficeContext = { offices:response.data.data, selected:previous.selected }
          return { ...previous, offices:response.data.data }
        })
      }).catch(() => {})
    }
    window.addEventListener('solar-offices-updated', refresh)
    return () => { mounted = false; window.removeEventListener('solar-offices-updated', refresh) }
  }, [user.role])
  useEffect(() => {
    const sync = event => {
      if (event.key === 'solar_office' && event.newValue && event.newValue !== state.selected) window.location.assign('/dashboard')
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [state.selected])
  useEffect(() => {
    let cancelled = false
    const own = String(user.office?._id || user.office || '')
    const stored = user.role === 'Admin' ? localStorage.getItem(`solar_office_${user._id}`) || own : own
    setState({ loading:true, offices:[], selected:'', error:'' })
    const load = user.role === 'Admin' ? officesAPI.getAll() : officesAPI.getPublic()
    load.then(response => {
      if (cancelled) return
      const offices = response.data.data
      // A remembered Admin office is only a preference, never an authority.
      // Local and production databases can share user IDs but have different offices.
      const selected = offices.some(item => item._id === stored) ? stored : own
      if (!offices.some(item => item._id === selected)) throw new Error('Your assigned office is unavailable. Please contact Admin.')
      localStorage.setItem(`solar_office_${user._id}`, selected)
      localStorage.setItem('solar_office', selected)
      window.solarOfficeContext = { offices, selected }
      setState({ loading: false, offices, selected, error: '' })
    }).catch(error => { if (!cancelled) setState({ loading: false, offices: [], selected: stored, error: error.response?.data?.message || error.message }) })
    return () => { cancelled = true }
  }, [user._id, user.office, user.role])
  if (state.loading) return <div className="crm-card" style={{ margin:24 }}>Loading office…</div>
  if (state.error) return <div className="crm-card" role="alert" style={{ margin:24 }}><p>{state.error}</p><button className="btn btn-ghost" onClick={() => useAuthStore.getState().logout()}>Sign out</button></div>
  return <OfficeContext.Provider value={{ offices:state.offices, selected:state.selected }}>{children}</OfficeContext.Provider>
}
