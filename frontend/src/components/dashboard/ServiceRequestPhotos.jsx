import toast from 'react-hot-toast'
import { FilePreview } from '../common'

export default function ServiceRequestPhotos({ files, onChange, disabled, id }) {
  const select = event => {
    const selected = [...event.target.files]
    if (selected.length > 5 || selected.some(file => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      toast.error('Choose up to 5 JPG, PNG or WEBP photos, each 5 MB or smaller.')
      event.target.value = ''
      return
    }
    onChange(selected)
  }
  return (
    <div className="service-photo-input">
      <label className="form-label" htmlFor={id}>Photos (optional)</label>
      <input id={id} className="crm-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={select} />
      <small>Up to 5 photos per update, 5 MB each.</small>
      {files.length > 0 && <div className="service-photo-grid">{files.map((file, index) => <FilePreview key={`${file.name}-${index}`} file={file} label={`Photo ${index + 1}`} compact />)}</div>}
    </div>
  )
}
