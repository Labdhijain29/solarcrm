import { useEffect, useState } from 'react'
import { FaDownload, FaEye, FaFile, FaFilePdf, FaImage, FaVideo } from 'react-icons/fa'
import { getFileDisplayName, getFileKind, getPublicFileUrl, hasFileValue, isBrowserFile } from '../../utils/files'

const KIND_ICON = {
  image: FaImage,
  video: FaVideo,
  pdf: FaFilePdf,
  document: FaFile,
}

export default function FilePreview({ file, label = 'File', fallbackName = 'document', compact = false }) {
  const [objectUrl, setObjectUrl] = useState('')

  useEffect(() => {
    if (!isBrowserFile(file)) {
      setObjectUrl('')
      return undefined
    }

    const nextUrl = URL.createObjectURL(file)
    setObjectUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  if (!hasFileValue(file)) return null

  const url = objectUrl || getPublicFileUrl(file)
  const name = getFileDisplayName(file, fallbackName)
  const kind = getFileKind(file)
  const Icon = KIND_ICON[kind] || FaFile

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: compact ? 8 : 10,
        display: 'grid',
        gridTemplateColumns: compact ? '32px minmax(0,1fr) auto' : '46px minmax(0,1fr) auto',
        gap: 10,
        alignItems: 'center',
        background: 'var(--card)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: compact ? 32 : 46,
          height: compact ? 32 : 46,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg2)',
          color: 'var(--muted)',
          flexShrink: 0,
        }}
      >
        {kind === 'image' && url ? (
          <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon />
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 500, wordBreak: 'break-word' }}>{name}</div>
      </div>

      {url && (
        <div className="dashboard-inline-actions" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-icon" title="Open file" aria-label={`Open ${name}`}>
            <FaEye />
          </a>
          <a href={url} download={name} className="btn btn-secondary btn-sm btn-icon" title="Download file" aria-label={`Download ${name}`}>
            <FaDownload />
          </a>
        </div>
      )}

      {kind === 'video' && url && !compact && (
        <video controls src={url} style={{ gridColumn: '1 / -1', width: '100%', maxHeight: 220, borderRadius: 8, background: '#000' }} />
      )}
    </div>
  )
}
