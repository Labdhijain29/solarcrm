import { useEffect, useState } from 'react'
import { officesAPI } from '../services/api'

export default function useOfficeOptions() {
  const [state, setState] = useState({ offices: [], loading: true, error: '' })
  useEffect(() => {
    let active = true
    officesAPI.getPublic().then(response => { if (active) setState({ offices: response.data.data, loading: false, error: '' }) }).catch(() => { if (active) setState({ offices: [], loading: false, error: 'Unable to load offices. Please try again.' }) })
    return () => { active = false }
  }, [])
  return state
}
