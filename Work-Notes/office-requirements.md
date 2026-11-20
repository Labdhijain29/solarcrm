# Office separation requirements

Recorded: 17 November 2026.

Status: Local implementation completed after NCIF on 18 November 2026. Production migration to Ratlam was separately authorized by NCIF and completed/verified on 20 November 2026. Only Ratlam Office was created. Matching code deployment, live application checks and Render backend restart are still pending. See `office-implementation.md` for backup, audit, production Office ID and the remaining deployment sequence.

## Purpose and scope

- Work only in `solarcrm/`. Do not edit the sibling production project copy.
- Use the term **Office**, not Franchise.
- Treat all existing business data as belonging to **Ratlam Office**.
- Support additional offices such as Neemuch and Indore.
- Each office has its own users, leads, enquiries, service requests, inventory, stock, dispatches and related work.
- Office separation must apply throughout the application, including dashboards, counts, pipeline, searches, filters, assignments, notifications, follow-ups, reports, exports, documents and direct record links.
- Keep existing role permissions and workflows within the selected/assigned office.

## Agreed decisions

### Admin office selection

- Add a compact, themed Office dropdown in the top bar near the notification icon.
- Admin can switch offices.
- Always select one valid office; do not provide an All Offices option.
- Every list, count, action and new record must use the selected office.
- On switching offices, clear/reload old office data and close stale record/edit dialogs. Prevent unfinished changes from being saved into a different office.

### Users

- Every normal user belongs to exactly one office and cannot switch offices.
- One email represents one account across the system; do not create duplicate accounts for different offices.
- Remove Franchise fields from user creation, registration, editing and details screens.
- Add a required Office selection to registration. Admin reviews the office before approving the account.
- Assign an office when Admin creates a user.
- Do not provide an option to move users between offices. This supersedes the earlier discussion about allowing Admin to move a user.
- Admin operates in the selected office; do not limit Admin to the normal user's single-office access rule.

### Office management

- Add an Offices listing in the sidebar for Admin.
- Add/Edit Office is accessible through direct links intended for developer use.
- Do not add separate Add/Edit menu entries or Add/Edit buttons in the normal sidebar listing.
- Updated requirement: the direct developer page `/dashboard/offices/new` includes an office list with Edit buttons and the Add/Edit form, so one link manages all offices.
- Direct Add/Edit links require an authenticated Admin. Knowing a URL does not grant access.
- Exact route names can be chosen during implementation.

Office fields:

| Field | Requirement |
| --- | --- |
| Office name | Required, e.g. Ratlam |
| Office code | Required and unique, e.g. RTM |
| Order | Set by dragging office handles, not by a number input. Mouse, touch and keyboard moves save automatically. Moving an office adjusts the others; new offices go last by default. Used by listings and all office dropdowns. Ratlam initially starts at 1. |
| Address | Optional |
| State | Optional |
| City | Optional |
| Pincode | Optional |
| Contact number | Optional |
| Email | Optional |
| Active / Inactive | Required |

- Inactive offices retain existing records/history and stop accepting new work.
- Handle users and Admin selection of an inactive office explicitly during implementation; never fall back to another office silently.

### Public website enquiries

- Add a required Office dropdown to the public website enquiry form.
- Show active offices only, with Ratlam selected by default.
- Save the enquiry under the selected office.
- Validate the office on the server, including for submissions made without login.

### Records and uniqueness

- IVRS remains optional where currently allowed.
- A supplied IVRS must be unique across all offices, including creation and updates, following the existing lead/enquiry duplicate rules.
- User emails remain globally unique.
- Do not add transfers of leads or other records between offices in this phase.
- Existing record IDs, numbers, relationships, assignment history, activity history, timestamps, photos, documents and passwords must be preserved.

## Implementation approach

1. Inspect the current code, actual database connection and existing data before changing anything. Do not assume a database is local because the app runs on localhost.
2. Add an Office model and a consistent office reference to office-owned records. Audit all models and embedded data; determine explicitly which settings/catalogues/counters are global versus office-owned.
3. Add shared backend office-context checks. Normal users derive their office from their saved account. Admin selects a validated office.
4. Apply office checks to reads, writes, record lookups, uploads/downloads, bulk operations, assignments and dashboard totals. Frontend filtering alone is insufficient.
5. Prevent cross-office relationships, such as assigning a lead or service request to a user from another office.
6. Keep uniqueness rules for email and IVRS global. Preserve existing record numbering; audit counter usage before changing it.
7. Add office APIs, listing, protected direct Add/Edit screens, top-bar selection and registration/enquiry Office dropdowns.
8. On an office switch, clear stale state and prevent late responses from the previous office from replacing the current screen's data.
9. Preserve current workflows and UI improvements. Use compact controls and the existing theme.

## Local database migration first

- User explicitly requested local database work first. Production access will be provided later.
- Verify the connection targets a local database before any write.
- Take a complete local backup and confirm restoration is possible.
- Record counts and important relationships before migration.
- Create Ratlam Office and assign all existing office-owned local records/users to it without recreating records.
- Preserve links, histories, files and existing account credentials.
- Make the migration repeatable without duplicating offices or overwriting existing office assignments.
- Check for records missing an office and relationships spanning different offices after migration.
- Keep an audit of migration counts and a recovery procedure.

## Session recovery requirements

- Logout, fresh login and expired sessions clear all saved user/office selections and private session state. Preserve theme and user login preferences.
- Session checks and Office-list bootstrap must not fail because the browser remembers an Office ID from another database.
- Validate the remembered Admin office; if it is stale, use the account's valid assigned office. Never grant a normal user another office when the real assignment is invalid.
- Delayed requests from a previous session must not restore old identity/notifications or clear a newer login. Keep logout/sign-in consistent across tabs.
- Clients must not need to clear site data manually. This fix was implemented and tested on 20 November 2026 and needs the matching code deployment; no further database update is required.


## Validation checklist for later implementation

- Existing Ratlam data and relationships remain intact after migration.
- A second office starts with no Ratlam business records.
- Admin switching refreshes every relevant screen and count.
- Normal users cannot access another office through APIs, changed IDs, direct URLs or files.
- Users cannot assign work to another office's users.
- Public enquiries enter the selected active office.
- Registration saves the selected office and retains Admin approval.
- Duplicate email and IVRS rules work across offices.
- Search, pipeline, exports, inventory, dispatch, service requests, notifications and follow-ups respect office context.
- No user/record transfer option and no All Offices selection exists.
- Inactive offices preserve history and reject new work.

## Production rollout status - 20 November 2026

- User confirmed the Render backend was stopped and authorized the production database migration through NCIF. MongoDB remained running.
- Only Ratlam Office was created, code `RTM`, order `1`, active. Production ID: `6afffb3b570540b2a3aed5e9`. The local ID is different and must not be used for production.
- Existing production business records and notifications were assigned to Ratlam, without importing local/demo data.
- Counts remained 117 leads, 47 enquiries, 10 users, 5 products, 64 inventory activities, 0 dispatches and 0 service requests.
- Full backup, checksum verification, local restore rehearsal, production transaction and independent post-migration verification passed. Existing documents, relationships and global email/IVRS indexes were preserved except for explicitly planned office additions and Product identity index replacement.
- Existing missing-reference counts were recorded and preserved; unrelated data repairs were not part of this migration.
- The backend was not restarted and code was not deployed by this migration. Deploy the matching frontend/backend, check startup indexes and real cloud file delivery, then reopen traffic after live smoke checks.
- The original local-only scripts remain local-only. A separate pinned production tool and completed backup/audit are documented in `office-implementation.md`.
- Any rollback or further production data changes need an explicit reviewed scope. Do not blindly rerun preparation or overwrite production with a local copy.

## Historical findings before implementation

- Franchise was profile metadata, not an access boundary. Office separation has now been implemented in the local code and the production database has been migrated as above.
- The deployed application still needs the matching office-aware release; code/schema compatibility checks were performed on a local migrated production copy.

## Working instructions

- DCIF means do not change files; inspect/discuss only.
- NCIF means implementation may proceed within the agreed scope.
- This requirements file records agreed decisions and subsequent implementation/migration status. It does not authorize arbitrary future production changes.
- Use simple English in discussions and client-friendly Hinglish for daily client work notes.
