# ☀️ Mahaveer Multi Engeering — Full-Stack CRM + Business Website

A production-ready **Solar Panel Business Website + CRM Dashboard** built with the **MERN Stack** (MongoDB, Express, React, Node.js).

---

## 🗂️ Project Structure

```
solarcrm/
├── backend/          # Node.js + Express REST API
│   ├── controllers/  # Auth, Lead, User, Enquiry, Dashboard logic
│   ├── routes/       # Express routers
│   ├── models/       # Mongoose schemas (User, Lead, Enquiry)
│   ├── middleware/   # JWT auth, role-based access, validation
│   ├── config/       # DB connection, seed script
│   └── server.js     # App entry point
│
└── frontend/         # React + Vite + Tailwind CSS
    └── src/
        ├── components/
        │   ├── common/       # MetricCard, PipelineBar, StageProgress, etc.
        │   ├── layout/       # SiteLayout, DashboardLayout (sidebar + topbar)
        │   ├── dashboard/    # LeadsTable, LeadModal
        │   └── website/      # EnquiryForm
        ├── pages/
        │   ├── auth/         # LoginPage
        │   ├── website/      # Home, About, Services, Contact
        │   └── dashboard/    # Admin, Manager, Sales, Stage, LeadDetail, etc.
        ├── services/         # Axios API layer
        ├── store/            # Zustand (auth + app state)
        └── utils/            # Constants, helpers
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)

### 1. Clone & Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
# Copy and edit .env
cd backend
cp .env.example .env
# Edit MONGODB_URI, JWT_SECRET, etc.
```

### 3. Seed Database

```bash
cd backend
npm run seed
```

This creates all 10 users and 45 sample leads.

### 4. Start Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev        # http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm run dev        # http://localhost:5173
```

---

## 🔐 Login Credentials (after seeding)

| Role                    | Email                      | Password       |
|-------------------------|----------------------------|----------------|
| Admin                   | admin@solarcrm.in          | admin123       |
| Manager                 | manager@solarcrm.in        | manager123     |
| Sales Manager           | sales@solarcrm.in          | sales123       |
| Registration Executive  | reg@solarcrm.in            | reg123         |
| Bank/Finance Executive  | bank@solarcrm.in           | bank123        |
| Loan Officer            | loan@solarcrm.in           | loan123        |
| Dispatch Manager        | dispatch@solarcrm.in       | dispatch123    |
| Installation Manager    | install@solarcrm.in        | install123     |
| Net Metering Officer    | netmeter@solarcrm.in       | netmeter123    |
| Subsidy Officer         | subsidy@solarcrm.in        | subsidy123     |

---

## 🌐 Website Pages

| Route       | Page     |
|-------------|----------|
| `/`         | Home     |
| `/about`    | About    |
| `/services` | Services |
| `/contact`  | Contact  |
| `/login`    | CRM Login|

---

## 📊 CRM Workflow Pipeline

```
Lead → Registration → Bank Approval → Loan Disbursement
     → Dispatch → Installation → Net Metering → Subsidy → Completed
```

**Rules:**
- Each stage is accessible only to its assigned role
- Admin can access and act on all stages
- Approve → moves lead to next stage (with notification)
- Reject → stops the workflow permanently
- Full history is maintained for every action
- Leads cannot skip stages

---

## 🔌 API Endpoints

### Frontend update checks

Each production build emits `version.json` and embeds the same build ID in its JavaScript
and the `app-build` HTML meta tag. A full page load checks the uncached version file before
opening the app. If the loaded JavaScript belongs to another release, it reloads once with
a version query marker, keeping the current route, filters and login data. Loop guards stop
repeated reloads; unavailable metadata times out after three seconds and lets the app open.
The check runs only on document startup, so it does not interrupt an open form.

`frontend/vercel.json` disables browser/CDN caching for HTML routes and `version.json`.
Content-hashed files under `/assets/` remain cacheable. Deploy the rebuilt frontend and its
Vercel configuration together; these settings do not update browsers until deployment.

Run the focused checks from `frontend` with `node --test tests/app-version.test.mjs`.

### Enquiry Executive

Admin can add users from **Users → Add User**. This uses the same account form as public
registration, including alternate contact, addresses, state/city, pincode, joining date,
franchise details and documents. Admin-created users are active and approved immediately;
public registrations remain pending. Both APIs share backend account validation, creation
and document-upload helpers. Documents accept PDF, JPG, PNG, DOC or DOCX, up to 5MB.
Joining date defaults to the current local date. Deleting a user requires a SweetAlert
confirmation; cancelling or dismissing the alert does not send a deletion request.

Register with the **Enquiry Executive** role and wait for Admin approval. After login,
the account opens `/dashboard/enquiries` with the enquiry form and shared enquiry list.
Executives can convert any non-service, unconverted enquiry. They can edit or delete
only their own unconverted enquiries. Profile, password change and logout remain available;
other business pages and APIs are blocked for this role.

Conversion assigns the lead at the **Lead** stage to the earliest-created active,
approved Manager (user ID breaks ties). No eligible Manager means conversion is blocked.
Existing roles retain their current assignment behaviour. Legacy/anonymous enquiries have
no creator; executives cannot edit or delete them, but can convert eligible records.

The new sparse unique `Lead.sourceEnquiry` index is created by Mongoose and explicitly
ensured before conversion. No ownership backfill is needed. Conversion keeps a private
reservation until the lead and enquiry link are saved. If a conversion fails, retry
**Create Lead** to resume that same reservation; edits/deletes stay blocked during recovery.

Run isolated backend permission and conversion tests (no application database writes):

```bash
cd backend
node --test tests/enquiry-executive.test.js
```

### Enquiry follow-ups

All roles with the Enquiries tab can submit an enquiry and record a follow-up on any
enquiry visible to that role. Sales roles continue to see non-service enquiries;
Service Manager sees service enquiries. Follow-ups are a shared, append-only
conversation history, including the note, next date, recording user and time.
The last saved follow-up sets the current due date, even when its date is earlier
than a previously entered date. Marking a follow-up complete clears that date;
conversion or closing the enquiry also stops outstanding reminders while retaining
the history. Follow-up access does not change enquiry edit/delete or lead permissions.

The Enquiries screen shows Overdue, Due Today and Upcoming counts and filters.
The navigation and notification bell show outstanding follow-ups when the app is
open. Dates use the India calendar day. The due summary is read from the database
on load, focus and periodically; it does not send email, WhatsApp or browser push.
The shared view is at `/dashboard/enquiries` and Admin's embedded view is at
`/dashboard/admin?tab=enquiries`.

The API adds `POST /api/enquiries/:id/follow-ups` and
`GET /api/enquiries/follow-ups/due`. Follow-up entry fields are `note`, `dueDate`
(`YYYY-MM-DD`), and `completed`; actor identity is taken from authentication.

Run the isolated follow-up and permission checks from `backend`:

```bash
node --test tests/enquiry-follow-up.test.js tests/enquiry-executive.test.js
```

### Auth

```
POST   /api/auth/login           — Login
GET    /api/auth/me              — Get current user
PUT    /api/auth/change-password — Change password
POST   /api/auth/logout          — Logout
```

### Leads
```
GET    /api/leads                — Get leads (role-filtered)
POST   /api/leads                — Create lead
GET    /api/leads/:id            — Get single lead
PUT    /api/leads/:id            — Update lead
DELETE /api/leads/:id            — Delete (Admin only)
POST   /api/leads/:id/approve    — Approve & advance stage
POST   /api/leads/:id/reject     — Reject lead
POST   /api/leads/:id/note       — Add note
```

### Users
```
GET    /api/users                — All users (Admin/Manager)
POST   /api/users                — Create user (Admin)
PUT    /api/users/:id            — Update user (Admin)
DELETE /api/users/:id            — Delete user (Admin)
GET    /api/users/notifications  — Get notifications
```

### Enquiries
```
POST   /api/enquiries            — Submit enquiry (public)
GET    /api/enquiries            — List enquiries
POST   /api/enquiries/:id/convert — Convert to lead
```

### Dashboard
```
GET    /api/dashboard/stats      — Analytics stats
GET    /api/dashboard/activity   — Recent activity feed
```

---

## 🛠️ Tech Stack

**Backend**
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication (jsonwebtoken)
- bcryptjs (password hashing)
- express-validator (input validation)
- helmet + cors + express-rate-limit (security)

**Frontend**
- React 18 + Vite
- React Router v6 (routing)
- Tailwind CSS (styling)
- Framer Motion (animations)
- Recharts (charts/analytics)
- Zustand (state management)
- Axios (HTTP client)
- react-hot-toast (notifications)

---

## 🏗️ Production Deployment

### Backend (Railway / Render / VPS)
```bash
cd backend
npm start
```
Set environment variables: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV=production`

### Frontend (Vercel / Netlify)
```bash
cd frontend
npm run build   # outputs to dist/
```
Set `VITE_API_URL=https://your-api-domain.com/api`

### Cloudinary File Storage

Backend uploads use Cloudinary through `backend/services/storage/storageService.js`.
The frontend still sends files to the backend with `multipart/form-data`; it never uploads directly to Cloudinary.

Required backend environment variables:

```bash
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=your_app_folder
```

New uploads are stored as Cloudinary metadata (`fileUrl`, `fileKey`, `provider`, original name, mime type, and size).
Legacy `/uploads/...` values remain supported for existing test data and are still served by the backend when present.

---

## 📦 Features Summary

- ✅ Fully responsive website (Home, About, Services, Contact)
- ✅ Quick Enquiry form (saves to DB, converts to Lead)
- ✅ JWT-based secure login with role-based access control
- ✅ 10-role system with separate dashboards per role
- ✅ 9-stage CRM pipeline with sequential workflow enforcement
- ✅ Lead creation, assignment, approval, rejection
- ✅ Full history/activity log for every lead
- ✅ Admin: analytics, user management, all leads
- ✅ Manager: lead creation, kanban pipeline view
- ✅ Stage dashboards: Registration, Bank, Loan, Dispatch, Installation, Net Metering, Subsidy
- ✅ Recharts analytics (bar, area, pie, funnel)
- ✅ Dark/Light mode toggle
- ✅ In-app notifications
- ✅ Rate limiting and security headers
- ✅ Database seeder with 45 sample leads + all users
