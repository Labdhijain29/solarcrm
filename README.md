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
