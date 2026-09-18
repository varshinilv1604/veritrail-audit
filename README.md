# OBLIQ-in — Mini Audit Document Review System

A small working prototype for the workflow a CA firm actually runs: collect a
document from a client, review it, approve it or send it back with a reason,
and keep a trail of exactly who did what and when. Built for the OBLIQ-in
evaluation brief — scope is deliberately limited to that one workflow.

## Stack

| Layer    | Choice |
|----------|--------|
| Frontend | React (Vite), `react-router-dom`, plain CSS — no UI kit |
| Backend  | Node.js + Express |
| Auth     | JWT (firm id + role signed into the token), bcrypt password hashes |
| Database | SQLite, via Node's built-in `node:sqlite` module (no native build step) |
| Uploads  | Local disk via `multer`, served back through an authenticated route |

Kept deliberately boring: one process, one file-based DB, no ORM, no queue,
no cloud services. Nothing here needs to survive a scale test — it needs to
demonstrate the workflow and the access-control model clearly.

## Setup

Requires **Node.js 22.5+** (tested on Node 26). No external database to
install — `node:sqlite` ships with Node itself.

**Backend**

```bash
cd backend
cp .env.example .env    # sets PORT and JWT_SECRET
npm install
npm start                # http://localhost:4000
```

The backend **resets and reseeds its SQLite file on every boot** — this is a
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
`divya@xyzco.test`) with staff + reviewer permissions combined — optional
per the brief, included mainly to show the data model supports it.

## Screenshots

Full walkthrough as `rohit@abcco.test` (staff, Firm A) then
`aman@abcco.test` (reviewer, Firm A), then a cross-firm access attempt as
`karan@xyzco.test` (Firm B):

1. `screenshots/01-login.png` — login
2. `screenshots/02-clients.png` — Firm A's client list (only Firm A's client)
3. `screenshots/03-client-documents.png` — the 5 required documents, all `Pending`
4. `screenshots/04-document-detail-staff.png` — document detail, staff view
5. `screenshots/05-document-uploaded.png` — after upload, status → `Uploaded`
6. `screenshots/06-document-under-review-reviewer.png` — reviewer started review
7. `screenshots/07-correction-requested.png` — correction requested, with reason, full audit history visible
8. `screenshots/08-firm-b-clients.png` — logged in as Firm B, sees only Firm B's client
9. `screenshots/09-tenant-isolation-blocked.png` — Firm B user navigating **directly to Firm A's client URL** gets `Client not found`, not Firm A's data

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
`document → client → firm` just to check ownership. Fewer joins to get
right also means fewer places a firm-scoping bug can hide.

`audit_events` is **insert-only** — no route in the backend issues an
`UPDATE` or `DELETE` against it. There is no API endpoint that can modify or
remove a past event, for any role.

## Status flow

```
Pending → Uploaded → Under Review → Approved
                          ↓
                  Correction Required → Uploaded (revised) → Under Review → ...
```

- **Staff**: upload / re-upload a document. Allowed from any status except
  `Approved`.
- **Reviewer**: start review (`Uploaded → Under Review`), then either
  **Approve** or **Request Correction** (requires a comment). Both actions
  only valid from `Under Review` — enforced server-side, not just hidden in
  the UI.
- Every one of those actions writes one row to `audit_events` in the same
  request, e.g. `"Aman Gupta requested correction"` with the comment
  `"Page 3 is missing. Please upload the complete bank statement."`,
  timestamped and attributed to the actor from their verified JWT (never
  from a client-supplied name field).

## Architecture & tenant isolation

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
audit_events — insert-only, one row per state change
```

**Authentication** (who are you) happens once, at login: the server checks
the password hash and issues a JWT with `userId`, `firmId`, and `role`
signed into it. **Authorization** (what are you allowed to touch) is
checked independently, on every request, in two layers:

1. **Role check** (`requireRole`) — e.g. only `reviewer`/`admin` can hit
   `POST /documents/:id/approve`. A `staff` token gets `403` even with a
   perfectly valid, unexpired JWT.
2. **Ownership check** — every query scopes by `firm_id`, taken only from
   the verified JWT payload, never from a request body/query param a client
   could tamper with. A lookup for a specific client or document *also*
   requires `firm_id` to match in the same `WHERE` clause, so even a
   correctly-guessed numeric ID belonging to another firm returns nothing.

The important bit: a cross-firm request doesn't get a `403 Forbidden` (which
would confirm the resource exists elsewhere) — it gets the same `404 Not
Found` as an ID that doesn't exist at all. Firm B genuinely cannot tell
Firm A's data exists.

This was verified live, not just read off the code: with two real JWTs (one
per firm) I ran cross-firm requests via `curl` directly against the API —
bypassing the UI entirely, since **a frontend hiding a button proves
nothing about the backend**. Listing clients, listing another firm's
documents by client ID, and fetching another firm's document by ID all
returned `404`; role-mismatched actions (staff calling `/approve`) returned
`403`. The UI screenshots (`08`, `09` above) show the same thing through the
browser.

**Known limitation, stated plainly**: isolation is enforced by the
application layer (every handler filters by `firm_id`), not by the database
itself. A future route that forgets the `WHERE firm_id = ...` clause would
be a real bug. See "What I'd improve" below.

## Other security notes

- Passwords are hashed with bcrypt; plaintext is never stored or returned.
- Login returns the same generic "Invalid email or password" whether the
  email doesn't exist or the password is wrong — no account enumeration.
- Uploaded files are renamed to a random UUID on disk; the user-supplied
  original filename is stored only as a DB column for display, never used
  to build a filesystem path (no path traversal via filename). Extension
  allowlist + 10MB cap on uploads.
- File downloads go through an authenticated route that re-checks firm
  ownership before streaming the file — not a public static file server.
- **Known simplification**: the JWT is kept in `localStorage`, which is
  readable by any script running on the page (an XSS risk in a real
  deployment). That's an acceptable tradeoff for a local prototype with no
  third-party scripts; a production build should move to an `httpOnly`,
  `SameSite` cookie with CSRF protection instead.

## AI Tools Used

ChatGPT:
Claude: Used throughout — via Claude Code, to design and implement the
entire backend (schema, auth/tenant-isolation middleware, routes), the
frontend (React pages, API client), and this README, and to run the live
verification probes (`curl` cross-firm tests, a scripted Playwright pass
through the UI) described above.
Gemini:
Cursor:
GitHub Copilot:

**How AI was used**: I used Claude Code as the primary builder for this
prototype — from schema design through implementation to the live
verification steps referenced in this README (the `curl` cross-tenant
probes and the browser screenshots). I directed the scope, the data model
decisions (e.g. denormalizing `firm_id`, the 404-not-403 isolation
behavior, insert-only audit log), and reviewed the resulting code and
screenshots myself before treating anything as "done" — a passing screenshot
or a 200 response isn't proof by itself, so the cross-firm checks were run
as real requests against the running server, not inferred from reading the
code.

## What would I improve with one more week?

The single highest-value next step is moving tenant isolation from
"every handler remembers to filter by `firm_id`" to something the database
itself enforces — e.g. Postgres row-level security policies keyed on
`firm_id`, checked on every query regardless of what the application code
does. Right now isolation is correct, and I verified it live, but it's
correct *by discipline*: a future route that forgets one `WHERE` clause is
a real vulnerability, not just a theoretical one. RLS (or equivalent)
turns that from "every developer must remember" into "the database
refuses regardless." Paired with that, I'd add DB-level grants that revoke
`UPDATE`/`DELETE` on `audit_events` for the application's runtime role, so
audit immutability is enforced by the database, not just by "no route
happens to expose it."

Second: file revision history. A correction cycle currently overwrites the
previous file on disk (the audit log records *that* a revision happened,
but not the earlier file's actual content) — a reviewer re-checking "was
page 3 actually added?" against the old version can't retrieve it.

Third: an admin/partner screen for actually managing firm membership
(inviting staff, assigning clients to specific staff members) — the role
exists in the data model but has no dedicated UI today, so a real firm
onboarding a second reviewer has no way to do it themselves.

I'd pick DB-enforced isolation first, specifically because it's the one
place where "looks correct in this demo" and "is actually safe" can most
easily diverge as the codebase grows past what one person can review by eye.
