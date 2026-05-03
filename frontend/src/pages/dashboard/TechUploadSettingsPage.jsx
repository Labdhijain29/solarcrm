import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FaCloudUploadAlt, FaSave, FaShieldAlt } from 'react-icons/fa'
import { PageHeader, Spinner } from '../../components/common'
import { settingsAPI } from '../../services/api'
import { useAuthStore } from '../../store'

const UPLOAD_SETTING_TYPES = [
  'STORAGE_PROVIDER',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_FOLDER',
]

const LABELS = {
  STORAGE_PROVIDER: 'Storage Provider',
  CLOUDINARY_CLOUD_NAME: 'Cloudinary Cloud Name',
  CLOUDINARY_API_KEY: 'Cloudinary API Key',
  CLOUDINARY_API_SECRET: 'Cloudinary API Secret',
  CLOUDINARY_FOLDER: 'Cloudinary Folder',
}

const PLACEHOLDERS = {
  STORAGE_PROVIDER: 'cloudinary',
  CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
  CLOUDINARY_API_KEY: 'Enter new API key to replace',
  CLOUDINARY_API_SECRET: 'Enter new API secret to replace',
  CLOUDINARY_FOLDER: 'solarcrm',
}

const getEmptyForm = () => Object.fromEntries(UPLOAD_SETTING_TYPES.map((type) => [type, '']))

export default function TechUploadSettingsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [settings, setSettings] = useState([])
  const [form, setForm] = useState(getEmptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const settingsByType = useMemo(() => (
    Object.fromEntries(settings.map((setting) => [setting.type, setting]))
  ), [settings])

  const loadSettings = () => {
    setLoading(true)
    settingsAPI.getUpload()
      .then(({ data }) => {
        const nextSettings = data.data || []
        setSettings(nextSettings)
        setForm(Object.fromEntries(UPLOAD_SETTING_TYPES.map((type) => {
          const setting = nextSettings.find((item) => item.type === type)
          return [type, setting?.isSecret ? '' : setting?.description || '']
        })))
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Failed to load upload settings')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role && user.role !== 'Admin') {
      navigate('/dashboard', { replace: true })
      return
    }

    loadSettings()
  }, [user?.role])

  const updateField = (type, value) => {
    setForm((prev) => ({ ...prev, [type]: value }))
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    setSaving(true)

    try {
      const payload = Object.fromEntries(UPLOAD_SETTING_TYPES.map((type) => [type, form[type] || '']))
      const { data } = await settingsAPI.updateUpload(payload)
      const nextSettings = data.data || []
      setSettings(nextSettings)
      setForm(Object.fromEntries(UPLOAD_SETTING_TYPES.map((type) => {
        const setting = nextSettings.find((item) => item.type === type)
        return [type, setting?.isSecret ? '' : setting?.description || '']
      })))
      toast.success(data.message || 'Upload settings saved')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save upload settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner size={42} />

  return (
    <div className="dashboard-page" style={{ maxWidth: 980 }}>
      <PageHeader
        icon={<FaCloudUploadAlt />}
        title="Upload Settings"
        subtitle="Hidden Admin-only configuration for backend file storage"
      />

      <div className="crm-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <FaShieldAlt style={{ marginTop: 3, color: 'var(--sun)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Secret values are write-only</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              API key and API secret show only configured status. Leave them blank to keep the existing stored value.
            </div>
          </div>
        </div>
      </div>

      <form className="crm-card" onSubmit={saveSettings}>
        <div className="dashboard-form-grid">
          {UPLOAD_SETTING_TYPES.map((type) => {
            const setting = settingsByType[type] || {}
            const isSecret = Boolean(setting.isSecret)
            const isConfigured = Boolean(setting.isConfigured)

            return (
              <label key={type} style={{ display: 'grid', gap: 8 }}>
                <div className="dashboard-split-row" style={{ gap: 8 }}>
                  <span className="form-label" style={{ margin: 0 }}>{LABELS[type]}</span>
                  <span className={`badge ${isConfigured ? 'badge-green' : 'badge-red'}`}>
                    {isConfigured ? 'Configured' : 'Missing'}
                  </span>
                </div>
                <input
                  className="crm-input"
                  type={isSecret ? 'password' : 'text'}
                  value={form[type] || ''}
                  onChange={(event) => updateField(type, event.target.value)}
                  placeholder={isSecret && isConfigured ? 'Leave blank to keep existing value' : PLACEHOLDERS[type]}
                  autoComplete="off"
                />
                <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {setting.helpText || type}
                </span>
              </label>
            )
          })}
        </div>

        <div className="dashboard-inline-actions" style={{ marginTop: 18 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <FaSave /> {saving ? 'Saving...' : 'Save Upload Settings'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadSettings} disabled={saving}>
            Reload
          </button>
        </div>
      </form>
    </div>
  )
}
