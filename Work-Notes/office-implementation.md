# Office implementation and production handoff

Implemented locally on 18 November 2026 in `solarcrm` only. Production database migration was authorized by NCIF and completed on 20 November 2026. Only Ratlam Office was created. Code deployment and backend restart are still pending; the sibling production checkout was not edited.

## What is available

- Admin top bar: one selected Office, compact searchable dropdown beside notifications; no All Offices option.
- Switching office confirms that open forms will close and reloads the dashboard. Other open tabs reload too. Old responses cannot replace the selected office's data.
- Users belong to one office. Normal users have an office label and cannot switch offices. No user or business-record office transfers were added.
- Franchise fields were removed from user screens. Registration selects an active office, default Ratlam. Admin creation uses the currently selected office; user editing does not change office.
- Sidebar Offices listing: `/dashboard/offices`.
- Direct Admin-only management page: `/dashboard/offices/new`. Includes the office list with Edit buttons, an Add Office button and the Add/Edit form. One developer link handles both actions. The management page uses a compact searchable office list beside the full-width editor, with the selected office highlighted; mobile stacks the list and form.
- Direct Admin-only Edit Office page: `/dashboard/offices/OBJECT_ID/edit` (replace OBJECT_ID with the office's MongoDB ID).
- No Add/Edit links or buttons in the sidebar or normal Offices listing; they appear only on the direct developer management page. Office listing API includes IDs for developer use: `GET /api/offices` with Admin authentication.
- Office fields: name, unique code, address, state, city, pincode, contact, email and Active/Inactive.
- Office Order: use drag handles in the developer office list; the numeric form input was removed. Mouse and touch dragging show a floating preview and highlighted drop position. Keyboard: Space to pick up, arrows/Home/End to move, Space to save, Escape to cancel. A completed move saves automatically and shows "Office order updated." Other offices shift automatically; new offices append by default. Reordering is disabled while searching or saving. Cancelled moves do not write, and failed saves reload the authoritative order. The original order is checked server-side before saving, so an outdated browser cannot overwrite another Admin's reorder. Admin/public lists and all office dropdowns use this order; the top-bar options refresh after saving. Existing local offices were numbered after another verified backup, with Ratlam first. Invalid positions and failed validation do not reorder offices. Saves share the Office-management lock; if rank writes fail after a save, the lock retains an `orderPlan` for recovery rather than allowing overlapping changes.
- Public enquiry form selects an active office, default Ratlam. Submission validates that office on the server.
- Inactive offices retain data, are readable by Admin and reject business writes. Normal users cannot use an inactive office. At least one active office must remain. Add/Edit Office remains accessible to Admin to reactivate an office.
- Lead/enquiry IVRS and account emails remain unique across all offices.

## Backend coverage

- Shared model checks use an AsyncLocalStorage office context and fail when no office is resolved.
- Office-owned models: User, Lead, Enquiry, ServiceRequest, Product, Dispatch and InventoryActivity.
- Reads, writes, direct IDs, counts, distinct queries, aggregation and populate are scoped. Assignments and linked business records must be from the same office.
- Dashboard, pipeline, stock, dispatch, service requests, follow-ups and user lists use the same checks.
- Admin self-profile/password operations and authentication use an explicit global identity lookup. This does not grant global business-record access.
- Notifications carry an office and are read/marked read for the selected office only. Existing notifications were assigned to Ratlam.
- Product identity uniqueness now includes office, allowing the same kind of stock in different offices.
- Existing lead and service-request counters remain global to preserve numbering and avoid collisions.
- IVRS locks, workflow locks and Office-management locks are global coordination records, not office business data.
- Upload-provider settings remain global infrastructure configuration. No office-specific provider credentials were introduced.
- Automatic creation of a demo Service Manager at login was removed because it would create an account without a chosen office. Normal existing account login remains supported.

## Files

- New uploads use `offices/OBJECT_ID/...` folders and private cloud delivery.
- Private assets are returned with refreshed signed download links after record authorization. New asset keys cannot reference another office's folder.
- Existing local `/uploads/...` paths are registered to their office by migration and use short-lived signed access links. Bare local file URLs are denied.
- Existing externally hosted public file URLs are preserved. Office-scoped APIs do not expose another office's records, but someone who already knows an old public provider URL can still open it. Revoking/migrating those existing cloud assets requires a separate storage review before production rollout.
- Real cloud uploads were not exercised. The new private-folder/signing behavior was checked with a mocked provider. Verify actual image, video and document delivery using the configured provider before deploying.

## Local database migration evidence

Actual configured target was verified as `127.0.0.1:27017/solarcrm` before writes.

Ratlam Office ID: `6afd64304c53c3f4334c5fe1`, code `RTM`.

| Collection | Before | After |
| --- | ---: | ---: |
| users | 12 | 12 |
| leads | 96 | 96 |
| enquiries | 31 | 31 |
| servicerequests | 2 | 2 |
| products | 5 | 5 |
| dispatches | 0 | 0 |
| inventoryactivities | 64 | 64 |

- All existing records in these collections were assigned to Ratlam.
- BSON-preserving Extended JSON backup includes every collection, collection options and indexes. Each backup was restored into a newly created temporary local database and compared with the source before migration. Only that temporary verification database was deleted.
- Existing documents were compared after tagging, excluding only the intended office fields and notification office tags. No IDs, histories, passwords, original timestamps or other record values changed.
- Repeated runs added no duplicate Ratlam Office and retagged zero existing records.
- Migration also creates office indexes, replaces only the old global Product identity index with its office compound index and registers legacy local file ownership.
- First, pre-office backup: `backend/backups/offices-2026-11-18T08-39-10-873Z/database.ejson.gz`.
- First backup SHA-256: `0f93ed484f4b8e540eacf681bbf1a3a77eeffdf287b52d1790856d790bd0e952`.
- Later idempotency/index/file-registry backups and `audit.json` files are in `backend/backups/offices-*`. Backups contain private records and are ignored by Git.

## Local migration and recovery commands

Run from `solarcrm/backend`:

```powershell
node config/migrate-offices-local.js
```

The migration refuses remote connections. Use it only with the app stopped so new writes cannot race with the backup and audit.

Recovery into a NEW local database, without overwriting the working database:

```powershell
node config/restore-office-backup-local.js backups/offices-2026-11-18T08-39-10-873Z/database.ejson.gz solarcrm_recovered_before_offices
```

This recovery tool refuses remote connections and existing target databases. Inspect the recovered database before choosing to point a local app at it. A pre-office recovery must use the corresponding pre-office code, or the office migration must run before the new code can access its records. Never overwrite production as part of this procedure.

## Verification performed

- `node --test backend/tests/office-isolation.test.js`: 12 checks passed against a separate temporary local database, using real authenticated HTTP routes, including office insert/move/append ordering and invalid inputs.
- Covered Admin selection, forged normal-user office headers, foreign record access/edits, dashboard/pipeline, registration approval state, email and IVRS duplicates, separate stock, cross-office assignment, service access, counts/aggregation/distinct, notifications, own-profile access, signed local files, private cloud upload options and inactive-office rules.
- `node tests/ui/offices.cjs`: passed using intercepted fixture APIs; no application data written. Covered desktop/mobile listing, office switching, user form, direct Add/Edit, public enquiry routing and normal-user restrictions. Reorder checks cover real mouse drag, touch drag via Chromium touch events, keyboard moves, cancellation, filtered-list disabling, conflict recovery and live top-bar option updates.
- Browser screenshots: ignored `test-results/offices/`.
- Frontend production build passed. Existing large-bundle and Browserslist warnings remain.
- Syntax checks and `git diff --check` passed. The entire older test suite was not run; older test fixtures need office context if they directly use scoped models.

## Production handoff and operating notes

- Restart the local backend to load the new routes/middleware, then refresh the frontend.
- Only Ratlam was created in the actual local database. Other offices used in automated checks existed only in temporary databases or browser fixtures.
- Local migration/recovery scripts still have no remote override. The separately reviewed production tool is `backend/config/office-production-migration.js`; see the completed migration record below.
- Production backup, restore rehearsal, migration and relationship audit are complete as recorded below. Matching code deployment, real cloud delivery checks, live application smoke checks and the backend restart remain pending. Existing public cloud URLs were preserved; changing their delivery permissions requires separate storage work.
- Maintenance scripts that query office-owned Mongoose models now need an explicit office context or a deliberately reviewed global maintenance context. Do not bypass this in request handlers.
- Office-management and lead/IVRS locks fail closed after a crashed writer. Inspect a stale lock and confirm its writer is stopped before removing it; no automatic TTL unlock is used.


## Production migration completed - 20 November 2026

Authorization: user confirmed the Render backend was stopped and gave NCIF to use the single commented production connection in `backend/.env`. That file was read without displaying credentials; its active local connection was not changed. No Render control action, Git push, code deployment or backend restart was performed.

Production database: `mahavirsolar`.

**Production Ratlam Office ID: `6afffb3b570540b2a3aed5e9`**, code `RTM`, order `1`, active. This is different from the local Office ID above. Do not copy a local Office ID into production.

Only Ratlam was created. Other offices can be added later through the developer management page. Existing records were updated in place; local/demo records were not imported into production.

| Collection | Before | After |
| --- | ---: | ---: |
| users | 10 | 10 |
| leads | 117 | 117 |
| enquiries | 47 | 47 |
| products | 5 | 5 |
| inventoryactivities | 64 | 64 |
| dispatches | 0 | 0 |
| servicerequests | 0 | 0 |
| counters | 1 | 1 |
| settings | 5 | 5 |
| offices | 0 | 1 |
| officefiles | 0 | 0 |

- Existing business records and user notifications were assigned to Ratlam.
- Native MongoDB updates ran inside a production transaction with snapshot read concern and majority write concern. Index preparation/replacement took place outside the transaction.
- Added office indexes and the office-scoped unique Product identity index. The replacement was built before dropping only the old global Product identity index.
- Existing email and IVRS indexes and all other existing indexes were preserved. Counters/settings were not changed.
- Every document was compared against the backup plus only the planned changes. IDs, passwords, timestamps, activity histories, files and unrelated values were preserved.
- No legacy local upload paths were found in this production backup; the file ownership registry is empty. Cloud files were not moved or modified.
- An independent second read-only verification passed after commit. No cross-office relationships were introduced.

### Production backup and rehearsal evidence

Private backup directory, ignored by Git:

`backend/backups/production-offices-2026-11-20T07-48-09-337Z/`

Contents:

- `database.ejson.gz`: BSON-preserving backup of all collections, collection options and indexes.
- `plan.ejson`: target, proposed Office ID and verified migration plan. It does not contain the database URI.
- `prepare-audit.json`: counts, restore/rehearsal evidence and baseline missing-reference counts.
- `apply-started.json`: application start marker.
- `production-audit.json`: committed result, checksums, counts and relationship audit.

Backup SHA-256:

`13e2223a3df88dde153de31da8342af8c1002dfcc18f6535ec2146c9a5a22f2c`

The backup was restored into a separate local rehearsal database and compared with the source. The same migration then passed on that local copy before production writes began. Production was checked again against the unchanged backup immediately before application. Intermittent sandbox DNS failures occurred before connection; the successful application and final verification ran with approved network access. Credentials were not logged.

Do not commit, share publicly or deploy the backup folder: it contains private records and settings.

### Existing relationship gaps preserved

These existed before the migration and have the same counts afterward:

- 7 lead assignments refer to missing users.
- 7 enquiry conversion links refer to missing leads.
- 30 inventory activity product links refer to missing products.
- 17 inventory activity dispatch links refer to missing dispatches.

No records were deleted, reassigned or fabricated to repair these gaps. Review them separately; for example, an affected lead may need reassignment before normal editing can succeed under strict reference checks.

### Code compatibility checks for deployment

Startup index initialization was checked against the local migrated production copy, revealing two existing schema issues:

- Product text-index fields were aligned with the existing production index, avoiding an attempted second text index. SKU/code controller searches remain available through their existing filters.
- Three optional unique lead indexes (loan application, inverter number and meter number) used unsupported `$ne` partial filters. They now use `$type: 'string', $gt: ''` to index nonempty strings.

All eight office-related models then initialized their indexes successfully on the local production copy. Office-scoped model counts matched production. These schema corrections have not yet been deployed. The three corrected optional indexes were tested on the local copy; the live migration did not add them. They can be created by the matching backend's normal index initialization after deployment, which must be checked in startup logs.

The 12 backend office tests passed after the schema corrections and session-recovery fix below. Real cloud uploads and the deployed application remain unverified while the backend is stopped.

## Remaining deployment sequence

1. Keep Render backend instances, workers and any other production writers stopped. MongoDB stays running. Prevent public forms from accepting submissions during the maintenance window.
2. Deploy the matching backend and frontend release from `solarcrm`, including the new Office model, context/plugin, routes, file middleware, shared UI, and the two schema corrections above. Include required new source files; do not deploy only tracked diffs and accidentally omit untracked Office modules. Do not deploy `.env`, database backups or local test artifacts.
3. Keep Render's existing production database connection. Do not copy the workstation's active local `MONGODB_URI` into Render. Ensure production CORS/proxy configuration permits `X-Office-Id` and storage settings are configured.
4. Resume the backend only with the matching release ready. Check connection/startup/index logs before reopening general traffic. Existing production data is already migrated; do not run the local migration against the live database or repeat the production preparation blindly.
5. Under controlled access, verify Admin login, Ratlam selection, 117 leads/47 enquiries/10 users/5 stock items, pipeline/counts, role-scoped access, notifications, private document/photo/video delivery and a normal existing workflow. Do not leave dummy production leads or extra offices from testing.
6. Publish/activate the matching frontend and refresh stale browser sessions. Confirm registration/public enquiry Office choices and the developer management page. Only Ratlam should be present until an authorized Admin adds another office.
7. Reopen normal access after these checks pass. If a check fails, keep traffic closed and investigate before accepting new writes.

Production Ratlam edit link after deployment:

`/dashboard/offices/6afffb3b570540b2a3aed5e9/edit`

Single developer management link:

`/dashboard/offices/new`

## Production migration tool and recovery

`office-production-migration.js` is pinned to the reviewed production host and database and reads only the single commented production URI. `prepare` backs up and rehearses locally; `apply` requires its verified backup directory and `--backend-stopped`; `verify` performs a read-only comparison. It never changes `.env`, deploys code or starts a server.

Do not run `prepare` on this already-migrated database as though it were a fresh migration. It deliberately refuses existing offices. The completed plan can be verified read-only from `solarcrm/backend`:

```powershell
node config/office-production-migration.js verify "backups/production-offices-2026-11-20T07-48-09-337Z"
```

If a repeat `apply` uses the completed plan, it verifies the expected state instead of writing again. This strict verification is intended for the maintenance window: after legitimate new records/edits, it will report changes rather than treating them as migration damage.

For recovery, keep the backend stopped and preserve the backup plus both audits. First restore into a NEW local database for inspection; the existing local recovery tool supports this backup format:

```powershell
node config/restore-office-backup-local.js backups/production-offices-2026-11-20T07-48-09-337Z/database.ejson.gz solarcrm_recovered_production_before_offices
```

This restores locally only, without overwriting production. A production rollback needs an explicit reviewed plan covering both code and database/index state. Before reopening traffic, compare against the recorded expected state and reverse only intended migration changes, or restore the verified backup using a controlled production recovery procedure. If new writes have occurred, never restore the old backup blindly: preserve/reconcile those writes first. No production rollback was executed.


## Session and stale-office recovery fix - 20 November 2026

Reported case: the browser had logged into the local database, then the backend was switched to production. Local and production records shared the same user ID, but the Office IDs differed. The per-user saved office key survived logout and was restored on each new sign-in. Session checks also sent the stale Office header, so users were stuck until clearing browser site data.

Code changes (deployment required; no database migration required):

- Added shared session cleanup for logout, new sign-in and token expiry. Removes the token, user and all `solar_office` / `solar_office_*` selections, plus in-memory office context, notifications, unread counts and sidebar state. Theme, Remember Me and unrelated preferences are preserved.
- Logout clears client state immediately, even if the server is stopped. Its background server request uses the previous token without an Office header and cannot clear a later login.
- Login sends no previous authentication or Office header. Session identity/profile/password requests and the Admin Office-list bootstrap do not use the saved office selection. The backend resolves those identity/bootstrap requests against the authenticated user's assigned office; ordinary business requests still enforce the selected/assigned office.
- Admin's remembered choice is validated against the current office list before dashboard screens load. A stale remembered office falls back to the account's valid assigned office. Valid choices survive a same-session reload. A genuinely invalid or inaccessible assigned office remains blocked; normal users are never moved into another office automatically.
- Requests carry a session version and are cancelled or ignored when logout/login changes the session. Old success/error responses cannot restore a previous user, notifications or workspace, or log out a newer session.
- Session expiry resets the shared store; route guards return to login without duplicate page redirects. Other tabs follow logout/sign-in changes, without logged-out tabs broadcasting a reset loop.

Verification:

- `node tests/ui/session-recovery.cjs`: passed with intercepted APIs. Covered the exact local-to-production stale ID case, valid same-session office selection, logout against an unavailable backend, complete cache cleanup, preference preservation, fresh login, delayed profile/notification responses, expired sessions, cross-tab logout/sign-in and a genuinely invalid assigned office.
- `node tests/ui/offices.cjs`: office management, switching, add/edit, drag reordering, public enquiries and role checks passed.
- `node --test backend/tests/office-isolation.test.js`: 12 checks passed on a temporary local database, including stale-header identity/bootstrap recovery while foreign-office business access remains denied.
- Deploy the matching updated frontend and backend for clients to receive the fix. Users should not need to clear browser site data manually. No production data was modified for this session fix.
