# Upload File Feature README

Use this guide whenever adding a new upload feature to this project.

The current upload system is backend-only:

- Frontend sends files to the backend with `FormData`.
- Backend receives files through Multer memory storage.
- Backend uploads file buffers to Cloudinary through `storageService`.
- Frontend never uploads directly to Cloudinary.
- Existing legacy `/uploads/...` values must keep working.

## Required Environment

Backend requires:

```bash
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=your_app_folder
```

## Current Architecture

Backend files:

```text
backend/middleware/upload.middleware.js
backend/services/storage/storageService.js
backend/services/storage/cloudinaryStorage.js
backend/services/storage/fileAsset.js
backend/models/User.js
backend/models/Lead.js
```

Frontend files:

```text
frontend/src/services/api.js
frontend/src/utils/files.js
frontend/src/components/common/FilePreview.jsx
```

Important rule: provider-specific Cloudinary logic belongs only in `backend/services/storage/cloudinaryStorage.js`. Controllers should call `uploadFileAsset()` or `storageService`, not Cloudinary directly.

## Backend Checklist For A New Upload Field

1. Add the multipart field name to `leadFileFields` or create a new Multer middleware in `backend/middleware/upload.middleware.js`.

Example:

```js
{ name: 'siteSurveyPhoto', maxCount: 1 }
```

2. Add schema metadata fields beside any legacy display string.

Example:

```js
siteSurveyPhotoName: { type: String, trim: true, default: '' },
siteSurveyPhotoFile: fileAssetSchema,
```

3. Map the incoming field to the target schema in `backend/controllers/lead.controller.js`.

Example:

```js
siteSurveyPhoto: {
  target: 'installationData',
  nameField: 'siteSurveyPhotoName',
  fileField: 'siteSurveyPhotoFile',
  folder: 'installation',
},
```

4. Make sure the relevant route uses upload middleware.

Existing lead routes already support file uploads:

```js
uploadLeadFiles, normalizeMultipartBody
```

5. Keep JSON compatibility.

If no file is selected, the frontend should send the normal JSON payload. Only use `FormData` when a real file is included.

6. Store backward-compatible display values.

For new uploads, keep the old string field populated with the original file name or URL if the old UI expects it. Store the real durable file data in:

```js
{
  fileUrl,
  fileKey,
  provider,
  resourceType,
  originalName,
  mimeType,
  size
}
```

## Frontend Checklist For A New Upload Field

1. Add file state.

Example:

```js
const [form, setForm] = useState({
  siteSurveyPhoto: null,
})
```

2. Add the file input.

```jsx
<input
  className="crm-input"
  type="file"
  accept="image/*"
  onChange={(event) => setForm((prev) => ({
    ...prev,
    siteSurveyPhoto: event.target.files?.[0] || null,
  }))}
/>
```

3. Build `FormData` only when files exist.

```js
const payload = new FormData()
payload.append('stageData', JSON.stringify(stageData))
payload.append('siteSurveyPhoto', form.siteSurveyPhoto)
await leadsAPI.approve(leadId, payload)
```

If no file is selected:

```js
await leadsAPI.approve(leadId, { stageData })
```

4. Show previews with the shared component.

```jsx
<FilePreview
  file={form.siteSurveyPhoto || lead.installationData?.siteSurveyPhotoFile || lead.installationData?.siteSurveyPhotoName}
  label="Site survey photo"
  compact
/>
```

5. Use shared helpers for file URLs.

Use `frontend/src/utils/files.js`:

```js
getPublicFileUrl(file)
getFileDisplayName(file)
getFileKind(file)
hasFileValue(file)
```

These support:

- Cloudinary URLs
- file metadata objects
- legacy `/uploads/...` paths
- selected browser `File` objects
- old plain filename strings

## Naming Rules

Use clear, stable field names:

```text
<meaningfulFieldName>
<meaningfulFieldName>Name
<meaningfulFieldName>File
```

Example:

```text
siteSurveyPhoto
siteSurveyPhotoName
siteSurveyPhotoFile
```

Avoid generic names like:

```text
file
image
document
upload
```

unless the route has only one file field and the existing API already uses that name.

## Legacy Compatibility Rules

Do not break old records.

Old values may look like:

```text
/uploads/registrations/file.pdf
uploads/registrations/file.pdf
old-file-name.pdf
```

New values should use:

```js
{
  fileUrl: 'https://res.cloudinary.com/...',
  fileKey: 'folder/public_id',
  provider: 'cloudinary',
}
```

Frontend display logic must:

- use `http` URLs directly
- prepend backend base URL for `/uploads/...`
- use `fileUrl` for new metadata objects
- show plain old filenames as text without creating broken links

## File Type Rules

Current document uploads allow:

```text
.pdf, .png, .jpg, .jpeg, .doc, .docx
```

Current lead uploads allow:

```text
.pdf, .png, .jpg, .jpeg, .webp, .doc, .docx, .mp4, .mov, .avi, .mkv, .webm
```

Default file size limit is 5 MB per file. If a new feature needs larger files, update the limit deliberately and check Render/backend request limits.

## Testing Checklist

For every new upload feature, verify:

- JSON request still works when no file is selected.
- Multipart request works when one file is selected.
- Multiple file fields in one request work if applicable.
- Invalid file type returns a clean 400 error.
- Oversized file returns a clean 400 error.
- MongoDB stores both legacy-compatible display field and structured file metadata.
- Frontend preview works for selected local file before submit.
- Frontend preview/open/download works after refresh.
- Existing `/uploads/...` records still display correctly.

## Do Not Do This

- Do not import Cloudinary in controllers.
- Do not use `fs` for new uploads.
- Do not write files into `backend/uploads`.
- Do not upload directly from frontend to Cloudinary.
- Do not remove legacy string fields unless a real migration has been planned and run.
- Do not change existing API routes or field names unless the caller is updated at the same time.

