# VeriTrail (Mini Audit Document Review System)

A small working prototype for the workflow a CA firm actually runs: collect a
document from a client, review it, approve it or send it back with a reason,
and keep a trail of exactly who did what and when. Built for the OBLIQ-in
evaluation brief; scope is deliberately limited to that one workflow.

## Overview

A CA firm's audit work runs on a repeatable checklist: every client needs to
hand over the same handful of documents (bank statement, sales register,
purchase register, GST return, expense summary), someone on staff has to
collect and re-collect them until they're right, and a reviewer has to sign
off before the file is considered done. The part that actually matters for
an audit isn't the upload button, it's being able to answer "who approved
this, when, and what did they check" months later without guessing.

VeriTrail is that workflow, and nothing else. One login screen, a client
list scoped to your firm, a document checklist per client, and a document
detail page that's half "upload/review controls" and half "audit trail."
Two firms share one deployment but never see each other's data. Two roles
(staff, reviewer, plus an optional combined admin) get different controls
on the same document, enforced by the server, not hidden by the UI.

What's intentionally not here: WhatsApp integration, GST filing, tax
calculation, government portal automation, OCR, AI agents, a mobile app, a
payment system, a complex analytics dashboard, production-grade auth, or
cloud-scale infrastructure. None of that is what makes an audit document
review tool trustworthy. A correct status flow, an honest audit trail, and
access control that actually holds up under a direct cross-firm request are
what makes it trustworthy, so that's what got the time.

## Architecture

| Layer    | Choice |
|----------|--------|
| Frontend | React (Vite), `react-router-dom`, plain CSS, no UI kit |
| Backend  | Node.js + Express |
| Auth     | JWT (firm id + role signed into the token), bcrypt password hashes |
| Database | SQLite, via Node's built-in `node:sqlite` module (no native build step) |
| Uploads  | Local disk via `multer`, served back through an authenticated route |

Kept deliberately boring: one process, one file-based DB, no ORM, no queue,
no cloud services. Nothing here needs to survive a scale test; it needs to
demonstrate the workflow and the access-control model clearly.

```
Browser (React SPA)
   |  fetch, Authorization: Bearer <JWT>
   v
Express API
   |  requireAuth  -> verifies JWT, sets req.user = {userId, firmId, role}
   |  requireRole  -> rejects if req.user.role isn't allowed for this route
   |  every query  -> WHERE firm_id = req.user.firmId (and, for a specific
   |                  row, id = :id AND firm_id = req.user.firmId together)
   v
SQLite: firms / users / clients / documents / audit_events
   |
   v
audit_events -> insert-only, one row per state change
```

**Authentication** (who are you) happens once, at login: the server checks
the password hash and issues a JWT with `userId`, `firmId`, and `role`
signed into it. **Authorization** (what are you allowed to touch) is
checked independently, on every request, in two layers:

1. **Role check** (`requireRole`): e.g. only `reviewer`/`admin` can hit
   `POST /documents/:id/approve`. A `staff` token gets `403` even with a
   perfectly valid, unexpired JWT.
2. **Ownership check**: every query scopes by `firm_id`, taken only from
   the verified JWT payload, never from a request body/query param a client
   could tamper with. A lookup for a specific client or document *also*
   requires `firm_id` to match in the same `WHERE` clause, so even a
   correctly-guessed numeric ID belonging to another firm returns nothing.

The important bit: a cross-firm request doesn't get a `403 Forbidden`
(which would confirm the resource exists elsewhere), it gets the same
`404 Not Found` as an ID that doesn't exist at all. Firm B genuinely cannot
tell Firm A's data exists.

This was verified live, not just read off the code: with two real JWTs (one
per firm) I ran cross-firm requests via `curl` directly against the API,
bypassing the UI entirely, since **a frontend hiding a button proves
nothing about the backend**. Listing clients, listing another firm's
documents by client ID, and fetching another firm's document by ID all
returned `404`; role-mismatched actions (staff calling `/approve`) returned
`403`. Screenshots `08` and `09` below show the same thing through the
browser: a Firm B reviewer navigating directly to Firm A's client URL gets
"Client not found," not Firm A's data.

**Known limitation, stated plainly**: isolation is enforced by the
application layer (every handler filters by `firm_id`), not by the database
itself. A future route that forgets the `WHERE firm_id = ...` clause would
be a real bug. See "What would I improve" below.

### Project layout

```
backend/src/
  server.js       express app, route mounting, error handler
  db.js           schema (SQLite, reset + recreated on every boot)
  auth.js         issueToken / requireAuth / requireRole
  seed.js         fixed two-firm demo dataset
  routes/
    auth.js       login, self profile edit (PATCH /auth/me)
    clients.js    list/create clients, list a client's documents
    documents.js  document detail, upload, start-review, approve,
                  request-correction, authenticated file download

frontend/src/
  api.js            thin fetch wrapper, one function per endpoint
  AuthContext.jsx   session state, split login()/applySession() so a
                    branded transition can hold the redirect
  App.jsx           routes + the logged-in/logged-out guard
  pages/            Login, Clients, ClientDetail, DocumentDetail
  components/       TopBar, StatusBadge, Logo, Splash, EditProfileModal,
                    icons.jsx (shared inline SVG icon set)
```

## Workflow

```
Pending -> Uploaded -> Under Review -> Approved
                            |
                    Correction Required -> Uploaded (revised) -> Under Review -> ...
```

1. **Staff** create a client, which seeds its 5 required documents as
   `Pending`, then upload each one. Upload is allowed from any status
   except `Approved`, so a rejected document can simply be re-uploaded.
2. **Reviewer** starts a review (`Uploaded -> Under Review`), then either
   **Approves** or **Requests Correction** (a reason is required). Both
   actions are only valid from `Under Review`, enforced server-side with a
   `409` on any other status, not just hidden in the UI.
3. Every one of those actions writes one row to `audit_events` in the same
   request, attributed to the actor from their verified JWT (never a
   client-supplied name field), for example:

   ```
   7:30:02 PM  Rohit Sharma uploaded Bank_Statement.pdf
   7:30:06 PM  Aman Gupta started reviewing Bank_Statement.pdf
   7:30:06 PM  Aman Gupta requested correction
              Reason: Page 3 is missing. Please upload the complete
              bank statement.
   7:31:40 PM  Rohit Sharma uploaded revised document
   ```

4. **Admin** combines staff and reviewer permissions on the same firm; it
   exists mainly to show the data model supports a combined role, not
   because this prototype needed a third distinct workflow.

## What it does

- **Client and document checklist.** Create a client, get its 5 required
  documents automatically, track completion with a progress bar ("3 of 5
  documents approved") on the client list and client detail page.
- **Upload / re-upload.** Extension allowlist, 10MB cap, original filename
  kept only for display; the file on disk is renamed to a random UUID.
- **Review actions.** Start review, approve, or request correction with a
  required reason, each gated by role and current status.
- **Audit trail.** A timeline on every document showing who did what and
  when, with the correction reason called out, an icon per action type
  (upload, review, approve, correction), and insert-only storage so no
  route can edit or delete a past event.
- **Tenant isolation.** Two firms, one deployment, zero cross-firm leakage;
  verified live, not just asserted (see Architecture above).
- **Authenticated file download.** Files stream through a route that
  re-checks firm ownership first, not a public static file server.
- **Self-service profile editing.** Any signed-in user (staff or reviewer
  alike) can edit their own display name via a pencil icon in the top bar;
  scoped to their own verified `userId`, so no one can edit anyone else.
- **Branded sign-in.** A short loading screen appears the moment the login
  form is submitted, for any email, valid or not, so the wait for the
  server never looks like the app has frozen; a successful sign-in holds
  that screen a little longer as a deliberate "VeriTrail, verified every
  step" moment before landing on the app.

## Getting started

Requires **Node.js 22.5+** (tested on Node 26). No external database to
install; `node:sqlite` ships with Node itself.

**Backend**

```bash
cd backend
cp .env.example .env    # sets PORT and JWT_SECRET
npm install
npm start                # http://localhost:4000
```

The backend **resets and reseeds its SQLite file on every boot**; this is a
demo/eval prototype, not a system that needs to retain state across
restarts, and a fixed seed makes every run reproducible. Seed data: two
firms, each with a client and its 5 required documents, all `Pending`.

**Frontend** (separate terminal)

```bash
cd frontend
cp .env.example .env    # points VITE_API_URL at the backend
npm install
npm run dev              # http://localhost:5173
```

### Demo accounts

All passwords: `password123`

| Firm | Client | Staff | Reviewer |
|---|---|---|---|
| ABC & Co. | ABC Traders Pvt. Ltd. | rohit@abcco.test | aman@abcco.test |
| XYZ & Co. | XYZ Retail Ltd. | neha@xyzco.test | karan@xyzco.test |

An `admin` role also exists per firm (e.g. `priya@abcco.test`,
`divya@xyzco.test`) with staff + reviewer permissions combined; optional
per the brief, included mainly to show the data model supports it.

## Screenshots

Full walkthrough as `rohit@abcco.test` (staff, Firm A) then
`aman@abcco.test` (reviewer, Firm A), then a cross-firm access attempt as
`karan@xyzco.test` (Firm B):

1. `screenshots/01-login.png`: login
2. `screenshots/02-clients.png`: Firm A's client list, only Firm A's client,
   with its document-completion progress bar
3. `screenshots/03-client-documents.png`: the 5 required documents, all
   `Pending`
4. `screenshots/04-document-detail-staff.png`: document detail, staff view
5. `screenshots/05-document-uploaded.png`: after upload, status ->
   `Uploaded`
6. `screenshots/06-document-under-review-reviewer.png`: reviewer started
   review
7. `screenshots/07-correction-requested.png`: correction requested, with
   reason, full audit history visible
8. `screenshots/08-firm-b-clients.png`: logged in as Firm B, sees only Firm
   B's client
9. `screenshots/09-tenant-isolation-blocked.png`: Firm B user navigating
   **directly to Firm A's client URL** gets `Client not found`, not Firm
   A's data

## Data model

```
firms(id, name)
users(id, firm_id, name, email, password_hash, role)        role: staff | reviewer | admin
clients(id, firm_id, name, created_at)
documents(id, firm_id, client_id, doc_type, status, file_name, file_path,
          uploaded_by, uploaded_at, review_comment, reviewed_by, reviewed_at)
audit_events(id, firm_id, document_id, actor_user_id, action, comment, created_at)
```

`firm_id` is denormalized onto every table, including `documents` and
`audit_events`, not just `clients`. That's deliberate: it means every query
can filter on `firm_id` directly, without joining up through
`document -> client -> firm` just to check ownership. Fewer joins to get
right also means fewer places a firm-scoping bug can hide.

`audit_events` is **insert-only**; no route in the backend issues an
`UPDATE` or `DELETE` against it. There is no API endpoint that can modify or
remove a past event, for any role. One honest caveat: the audit trail looks
up each actor's *current* name from `users` at read time rather than
snapshotting it into the event row, so a later name change (via the profile
editor) applies retroactively to that user's past entries too. Acceptable
for a demo; a production system would snapshot the actor's name onto the
event at write time.

## Other security notes

- Passwords are hashed with bcrypt; plaintext is never stored or returned.
- Login returns the same generic "Invalid email or password" whether the
  email doesn't exist or the password is wrong; no account enumeration.
- Uploaded files are renamed to a random UUID on disk; the user-supplied
  original filename is stored only as a DB column for display, never used
  to build a filesystem path (no path traversal via filename). Extension
  allowlist + 10MB cap on uploads.
- File downloads go through an authenticated route that re-checks firm
  ownership before streaming the file, not a public static file server.
- Profile edits are scoped to `req.user.userId` from the verified JWT, so
  the endpoint can only ever change the caller's own name.
- **Known simplification**: the JWT is kept in `localStorage`, which is
  readable by any script running on the page (an XSS risk in a real
  deployment). That's an acceptable tradeoff for a local prototype with no
  third-party scripts; a production build should move to an `httpOnly`,
  `SameSite` cookie with CSRF protection instead.

## What would I improve with one more week?

The single highest-value next step is moving tenant isolation from "every
handler remembers to filter by `firm_id`" to something the database itself
enforces, for example Postgres row-level security policies keyed on
`firm_id` and checked on every query regardless of what the application
code does. Right now isolation is correct, and I verified it live with real
cross-firm requests, not just by reading the code, but it's correct *by
discipline*: a future route that forgets one `WHERE` clause is a real
vulnerability, not a theoretical one. RLS turns that from "every developer
must remember" into "the database refuses regardless." Alongside that, I'd
add database-level grants that revoke `UPDATE`/`DELETE` on `audit_events`
for the application's runtime role, so audit immutability is enforced by
the database itself, not only by the fact that no current route happens to
expose it.

Second priority: file revision history. A correction cycle currently
overwrites the previous file on disk; the audit log records *that* a
revision happened but not the earlier file's actual content, so a reviewer
re-checking "was page 3 actually added?" can't retrieve the old version to
compare.

Third: an admin/partner screen for actually managing firm membership,
inviting staff and assigning clients to specific reviewers. The role
already exists in the data model but has no dedicated UI, so a real firm
onboarding a second reviewer has no way to do it themselves today.

I'd pick database-enforced isolation first. It's the one place where
"looks correct in this demo" and "is actually safe" can most easily diverge
as the codebase grows past what one person can review by eye, and unlike
the other two, it's a security property, not a convenience feature.
