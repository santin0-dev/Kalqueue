# KalQueue

A clinic operations platform for Philippine community clinics, barangay health centers, and private practices. Built to solve the information asymmetry between patients, doctors, and admins that causes long waits, balik-balik problems, HMO delays, and missed appointments.

**Stack:** Next.js 14 · TypeScript · Prisma · PostgreSQL · NextAuth v5 · Pusher · Twilio · Zod · Tailwind CSS

---

## Table of Contents

1. [The Problem](#the-problem)
2. [System Design](#system-design)
3. [Data Model](#data-model)
4. [Folder Structure](#folder-structure)
   - [UI Layer](#ui-layer)
   - [Backend Layer](#backend-layer)
   - [System Design Layer](#system-design-layer)
5. [Environment Variables](#environment-variables)
6. [Local Setup](#local-setup)

---

## The Problem

Philippine clinics face a structural breakdown at every stage of the care journey. The root cause is not the individual problems (long waits, no-shows, charting burden, balik-balik) — it is that all four actors in the system are flying blind at the same time.

**Patients** do not know where they are in the queue, whether their doctor is available, or which documents to bring — so they wait indefinitely and often come back multiple times for the same appointment.

**Doctors** receive no pre-visit context. Every patient encounter starts from scratch: verbal history-taking, manual charting, and the inability to anticipate who is next. Walk-ins and appointments arrive in the same flat queue with no priority logic.

**Admins** manage doctors who move between clinics unpredictably, patients who book across Facebook, Messenger, and walk-in counters simultaneously, and no automated tools for reminders or double-booking prevention.

**The HMO / Assistance problem** is unique to the Philippine context. A patient with HMO coverage or PhilHealth/Malasakit assistance cannot be seen without a Letter of Authorization (LOA) — but LOA processing happens after the patient is already seated in the waiting area, meaning delays collapse the entire queue or force the patient to come back another day.

---

## System Design

### Mental Model: Airport, Not a Bank

The naive fix for a broken queue is a better number-dispenser — still linear, still FIFO, still collapsing when volume spikes. KalQueue is designed as a multi-stage pipeline, not a waiting line.

An airport has a check-in stage, a security stage, a gate stage, and a boarding stage. Each stage has its own capacity and its own queue. A delay at one stage does not collapse the others, because each stage is independently managed and every passenger knows exactly where they are at all times.

KalQueue applies this model to clinics: intake → priority calculation → weighted queue → HMO parallel track → consult → post-visit follow-up. Each stage is decoupled. A delayed doctor does not block intake. A pending LOA does not remove the patient from the queue. A missed appointment does not create a hole in the doctor's day.

---

### Layer 1 — Weighted Queue Engine

The core of the system. Located in `src/lib/queue-engine.ts`.

Every patient who enters the system receives a `QueueTicket`. Each ticket is assigned a `priorityWeight` — a single number that determines position. The queue is not FIFO. It is a sorted list, recomputed in real time, ordered by `priorityWeight DESC`.

**Priority weight formula:**

```
priorityWeight = (1,000,000,000,000 - createdAt.getTime()) + categoryBonus + typeBonus
```

The base score inverts the Unix timestamp so earlier arrivals rank higher. On top of that, two bonus layers are applied:

| Bonus Source | Value |
|---|---|
| PWD / Senior / Pregnant | +300 |
| Appointment (confirmed) | +200 |
| HMO with LOA secured | +100 |
| Regular / HMO pending | +0 |

This means a PWD walk-in will rank ahead of a regular walk-in, but an appointment holder will typically rank ahead of most walk-ins by design. The clinic admin controls the capacity ratios (60% appointments / 40% walk-ins by default) through `ClinicCapacityConfig`.

**Capacity blocks** prevent walk-in overflow from crushing appointment slots. Before any ticket is created, `checkCapacity()` counts active tickets by type for the day and enforces the configured ratio. If the walk-in ratio is exceeded, the patient goes to `OverflowWaitlist` and is notified — their data is preserved for the next available slot.

**Estimated wait time** is not a static field. It is recalculated dynamically based on `getAvgConsultDuration()`, which pulls the last 20 completed consultations for the specific doctor and computes average consult length from `calledAt` → `completedAt` timestamps. This gives a personalized, data-driven estimate per doctor rather than a generic fixed number.

Every queue state change — ticket created, status updated, doctor delayed, LOA secured — triggers `broadcastQueueUpdate()`, which pushes the full re-sorted ticket list to all connected clients in real time via Pusher.

---

### Layer 2 — Doctor Mobility Layer

Doctors in Philippine clinics are not stationary. They move between clinics, take extended rounds, and have unpredictable schedules. KalQueue models doctors as **mobile resources with declared availability windows**, not fixed calendar entries.

A doctor declares availability per-clinic, per-department, per-date as a time window (`startTime`, `endTime`). The window has a live status: `SCHEDULED → ACTIVE → DELAYED / ABSENT → DONE`.

When a doctor marks as **DELAYED**, `handleDoctorDelayed()` triggers:
1. Every waiting ticket's `estimatedWaitMinutes` is recalculated: `(position * avgDuration) + delayMinutes`.
2. Each affected patient receives an SMS and in-app notification with the new estimate.
3. Pusher broadcasts the updated estimates to all connected dashboards in real time.
4. No queue position is lost.

When a doctor marks as **ABSENT**, `handleDoctorAbsent()` triggers:
1. All waiting tickets for that doctor are set to `RESCHEDULED`.
2. The system looks for an alternate doctor in the same department at the same clinic who has an active availability window.
3. If found, new tickets are automatically created under the alternate doctor.
4. Every affected patient is notified by SMS and in-app.

This turns a doctor no-show from a complete operational failure into a managed handoff.

**Pre-consult brief**: When a doctor calls a patient (status → `IN_CONSULT`), the `ConsultationRecord` is created pre-populated with `priorSummary` pulled from the patient's most recent prior consultation findings. The intake form's `chiefComplaint` and `languageFlag` are already attached to the ticket. The doctor sees the patient's reason for visit, prior findings, language preference, and HMO status before the patient walks in.

---

### Layer 3 — HMO / Assistance Fast Lane

HMO LOA processing is a parallel track, not a step that blocks the main queue.

When a patient with `category: HMO` checks in, their ticket is created with `loaStatus: PENDING`. This means they are already in the queue — their position is calculated, they receive a queue number, and they can see their estimated wait time — but their ticket is excluded from the active set that doctors call from until `loaStatus` becomes `SECURED`.

The `getActiveTickets()` filter enforces this:
```ts
OR: [
  { loaStatus: { not: LOAStatus.PENDING } },
  { loaStatus: LOAStatus.SECURED },
]
```

While the patient waits, the HMO coordination officer processes the LOA separately. When LOA is secured, `secureLoa()` triggers:
1. The ticket's `loaStatus` is updated to `SECURED`.
2. A new `priorityWeight` is computed that now includes the HMO-secured bonus (+100), partially restoring any position that was lost during processing.
3. `broadcastLoaSecured()` notifies the patient's Pusher channel and the clinic dashboard instantly.
4. The queue is re-sorted and broadcast to all connected clients.

HMO patients approaching the front of the queue (position ≤ 5) automatically receive an LOA reminder notification: `"Please ensure your LOA is ready. Proceed to the HMO counter if not yet secured."` This is triggered as a side effect of every `updateTicketStatus()` call — no manual admin action required.

Government-assisted patients (PhilHealth / Malasakit) are flagged at intake through the `GOVERNMENT_ASSISTED` category and `documentChecklist`, which surfaces the required PhilHealth / Malasakit documents before the patient is even queued.

---

### Layer 4 — Unified Intake

The intake form is the entry gate that structures patient data before they reach the queue. `IntakeForm` captures three things:

1. **Chief complaint** — categorized, not free text, from a fixed set of common clinic visit types. This is intentional: structured complaints enable reliable document checklist derivation.
2. **Document checklist** — generated automatically by `getDocumentChecklist()` in `validations.ts` based on the complaint type. A patient booking "HMO consult" is told immediately to bring their HMO card, valid ID, and referral letter. This eliminates the most common cause of balik-balik (patient arrives without required documents).
3. **Language flag** — set at intake and attached to every downstream record. The doctor's pre-consult brief surfaces this flag so they know before the patient walks in.

---

### Layer 5 — Real-Time Communication

Two channels run in parallel: Pusher for live UI updates, Twilio for SMS.

**Pusher** maintains three channel types:
- `clinic-{id}` — clinic-wide events (queue updates, doctor delays, doctor absence)
- `doctor-{id}` — doctor-specific queue state
- `patient-{id}` — patient-specific events (called to consult, LOA secured)

Every queue state change broadcasts to the relevant channels simultaneously. The `QueueTicker` component in the frontend subscribes to the appropriate channels at mount and updates reactively — no polling, no page refresh.

**Twilio** sends SMS for events that require the patient to act outside the browser:
- Booking confirmation with document checklist
- 24-hour appointment reminder with current estimated wait
- Real-time queue position updates when position ≤ 3
- Doctor delayed — new estimated time
- Doctor absent — rescheduled notification
- LOA reminder when position ≤ 5
- Post-visit follow-up with consultation summary

Both channels operate independently. If Twilio credentials are absent, the system falls back to console logging and continues — the in-app notification is still written to the database regardless.

---

### Authentication and Role Routing

Three user roles: `PATIENT`, `DOCTOR`, `ADMIN`. Each role maps to a separate profile model (`Patient`, `Doctor`, `Admin`) linked to a shared `User` record.

Authentication uses NextAuth v5 with a credentials provider and JWT strategy. On sign-in, the JWT is populated with role, profile ID, and associated `clinicId` — meaning every API route can resolve the caller's clinic without an additional database lookup.

Middleware (`src/middleware.ts`) enforces role-based access at the edge before any page or API route renders. `/patient/*` routes redirect non-patients to login. `/doctor/*` redirects non-doctors. `/admin/*` redirects non-admins. Public routes (`/`, `/about`, `/features`, `/contact`, `/login`, `/register`, `/api/auth/*`) are exempted.

---

## Data Model

```
User
├── email (unique)
├── passwordHash
├── role: PATIENT | DOCTOR | ADMIN
└── profile → Patient | Doctor | Admin (one-to-one)

Patient
├── firstName, lastName, dateOfBirth
├── phone, address
├── category: REGULAR | PWD | SENIOR | PREGNANT | HMO | GOVERNMENT_ASSISTED
├── languagePreference (en | tl | ceb | ilo)
├── hmoProvider, hmoMemberNumber (nullable)
└── relations → Appointments, QueueTickets, IntakeForms, Notifications, ConsultationRecords

Doctor
├── firstName, lastName, specialty, licenseNumber, phone
└── relations → DoctorClinicAssignments, AvailabilityWindows, ConsultationRecords, QueueTickets

Admin
├── firstName, lastName
├── clinicId (the clinic this admin manages)
└── relations → Clinic, Announcements

Clinic
├── name, address, phone
├── type: PUBLIC | PRIVATE | COMMUNITY
└── relations → Departments, DoctorClinicAssignments, ClinicCapacityConfig, QueueTickets

Department
├── clinicId
├── name, floor, building, roomNumber
├── navigationInstructions (used in queue updates sent to patients)
└── relations → DoctorClinicAssignments, QueueTickets, AvailabilityWindows

DoctorClinicAssignment
├── doctorId, clinicId, departmentId
├── isActive
└── unique constraint on (doctorId, clinicId, departmentId)
    — doctors can be assigned to multiple clinics and departments simultaneously

AvailabilityWindow
├── doctorId, clinicId, departmentId
├── date (Date only, no time)
├── startTime, endTime (HH:MM strings)
├── status: SCHEDULED | ACTIVE | DELAYED | ABSENT | DONE
├── delayMinutes (set when status = DELAYED)
└── one window = one doctor's declared presence at one clinic for one day

ClinicCapacityConfig
├── clinicId (unique — one config per clinic)
├── appointmentRatio (default 0.6)
├── walkinRatio (default 0.4)
├── blockSize (default 10 — patients per capacity block)
└── maxDailyWalkins (default 50 — hard ceiling for walk-ins per day)

QueueTicket (the core operational record)
├── patientId, doctorId, clinicId, departmentId
├── type: APPOINTMENT | WALKIN
├── status: WAITING | IN_CONSULT | DONE | NO_SHOW | RESCHEDULED | CANCELLED
├── priorityWeight (Float — computed, determines queue order)
├── estimatedWaitMinutes (Int — updated dynamically)
├── calledAt (DateTime — set when status → IN_CONSULT)
├── completedAt (DateTime — set when status → DONE)
├── loaStatus: NOT_REQUIRED | PENDING | SECURED | FAILED
├── loaSecuredAt (DateTime — set when LOA confirmed)
└── intakeFormId (nullable — linked to pre-visit intake)

IntakeForm
├── patientId
├── chiefComplaint (structured category)
├── notes (free text, optional)
├── documentChecklist (JSON array — derived from chiefComplaint at creation)
└── languageFlag (carries patient's language preference forward)

ConsultationRecord
├── queueTicketId (unique — one record per consult)
├── doctorId, patientId
├── findings, prescription (filled by doctor during consult)
├── followUpDate (nullable)
└── priorSummary (auto-populated from the patient's most recent prior findings)

Notification
├── patientId
├── channel: SMS | PUSH | IN_APP
├── title, body
├── sentAt, read
└── triggeredBy (string tag identifying the event that triggered the notification)

Announcement
├── adminId
├── title, body
├── publishedAt, isActive
└── used by admins to broadcast clinic-wide messages (closures, schedule changes)

OverflowWaitlist
├── patientId, doctorId, clinicId, departmentId
├── type: APPOINTMENT | WALKIN
└── created when checkCapacity() returns overflow: true — patient is queued but held until capacity opens
```

---

## Folder Structure

The project follows Next.js App Router conventions. Folders are organized into three logical layers: UI (presentation only), Backend (API and data access), and System Design (the unique operational logic of KalQueue).

---

### UI Layer

These folders contain presentation and layout only — React components that render state, handle user input, and call API routes. No business logic lives here.

---

#### `public/`

Static assets served directly by Next.js.

| File | Purpose |
|---|---|
| `Global_logo.png` | KalQueue logo used across the navbar and marketing pages |
| `Home_img1.png` | Hero image for the landing page |

---

#### `src/app/globals.css`

Global CSS entry point. Imports Tailwind base styles. All component-level styling uses Tailwind utility classes inline.

---

#### `src/app/layout.tsx`

Root layout. Wraps the entire application in the `Providers` component (NextAuth `SessionProvider`), sets the HTML `<lang>` attribute, and applies the base font.

---

#### `src/app/(marketing)/`

Public-facing marketing pages. This is a Next.js route group (the parentheses mean the folder name does not appear in the URL). All pages here are accessible without authentication.

| File | Purpose |
|---|---|
| `layout.tsx` | Marketing layout wrapper — includes the public `Navbar` and `Footer` |
| `page.tsx` | Homepage (`/`) — hero section, feature highlights, CTA |
| `about/page.tsx` | About page (`/about`) — clinic problem framing, product story |
| `features/page.tsx` | Features page (`/features`) — system capabilities overview |
| `contact/page.tsx` | Contact page (`/contact`) — contact form placeholder |

---

#### `src/app/(auth)/`

Authentication pages. Route group — no prefix in URL.

| File | Purpose |
|---|---|
| `login/page.tsx` | Server component shell for the login page |
| `login/login-client.tsx` | Client component — login form, calls NextAuth `signIn()` with credentials |
| `register/page.tsx` | Registration form — role selector (Patient / Doctor / Admin), conditionally renders role-specific fields, posts to `/api/register` |

---

#### `src/app/patient/`

Patient-facing dashboard. All routes protected by middleware (requires `role: PATIENT`).

| File | Purpose |
|---|---|
| `layout.tsx` | Patient layout shell — sidebar navigation |
| `dashboard/page.tsx` | Patient home — active queue ticket display (uses `QueueTicker`), upcoming appointments, recent notifications |
| `book/page.tsx` | Booking flow — doctor/clinic/department selection, date/time picker, intake form step, submits to `/api/appointments` and `/api/queue` |
| `queue/page.tsx` | Live queue view — full `QueueTicker` for the patient's current ticket, navigation instructions from `department.navigationInstructions` |
| `profile/page.tsx` | Patient profile editor — category, language preference, HMO provider, contact details |

---

#### `src/app/doctor/`

Doctor-facing dashboard. All routes protected (requires `role: DOCTOR`).

| File | Purpose |
|---|---|
| `layout.tsx` | Doctor layout shell — sidebar navigation |
| `dashboard/page.tsx` | Doctor home — today's queue (uses `QueueTicker` in list mode), pre-consult brief per patient (chief complaint, language flag, HMO status, prior summary), call/complete/no-show controls |
| `queue/page.tsx` | Focused queue view for active consult management |
| `availability/page.tsx` | Availability window manager — declare clinic/department/date/time windows, mark as Active, Delayed (with delay minutes input), or Absent |

---

#### `src/app/admin/`

Admin-facing dashboard. All routes protected (requires `role: ADMIN`).

| File | Purpose |
|---|---|
| `layout.tsx` | Admin layout shell |
| `dashboard/page.tsx` | Clinic operations overview — queue summary across all doctors and departments, capacity utilization, HMO pending tickets |
| `doctors/page.tsx` | Doctor roster — active assignments, availability windows for the day, ability to mark doctor delayed/absent from the admin side |
| `records/page.tsx` | Consultation records viewer — searchable history of completed consults |
| `reports/page.tsx` | Daily summary reports — ticket volume, no-show rate, average wait time, HMO pending counts |
| `announcements/page.tsx` | Announcement manager — create, activate, deactivate clinic-wide announcements |

---

#### `src/components/ui/`

Primitive, unstyled-logic UI components. These are building blocks with no KalQueue-specific behavior.

| File | Purpose |
|---|---|
| `badge.tsx` | Status badge — color-coded by ticket status or category |
| `card.tsx` | Container card with optional title and subtitle props |
| `input.tsx` | Form primitives — `Input`, `Textarea`, `Select`, `Button` with consistent Tailwind styling |
| `modal.tsx` | Modal overlay with backdrop, close button, and slot for children |

---

#### `src/components/navbar.tsx`

Top navigation bar used on marketing pages. Renders links to `/about`, `/features`, `/contact`, and authentication CTAs. Conditionally shows user name and sign-out if session exists.

---

#### `src/components/footer.tsx`

Marketing page footer. Static links, copyright.

---

#### `src/components/dashboard-shell.tsx`

Shared sidebar + main content layout used by all three role dashboards (patient, doctor, admin). Accepts a `nav` prop (array of route links) and renders the appropriate navigation based on the active path.

---

### Backend Layer

API routes and data access. These handle HTTP, validate input, call the appropriate library functions, and return responses. No UI logic lives here.

---

#### `src/app/api/auth/[...nextauth]/route.ts`

NextAuth catch-all route. Re-exports the `handlers` object from `src/lib/auth.ts`. This single file enables NextAuth to handle all auth-related HTTP endpoints (`/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`, `/api/auth/callback/*`).

---

#### `src/app/api/register/route.ts`

User registration endpoint. Validates the registration payload with `registerSchema` from `validations.ts`. Creates the `User` record with a bcrypt-hashed password, then creates the role-specific profile (`Patient`, `Doctor`, or `Admin`) in a single database operation. Doctors and Admins require an invite code check.

---

#### `src/app/api/patients/route.ts`

Patient profile management. `GET` returns the authenticated patient's full profile including HMO details and language preference. `PATCH` validates updates with `updatePatientSchema` and applies partial updates to the Patient record.

---

#### `src/app/api/appointments/route.ts`

Appointment management. `GET` returns appointments for the authenticated user (filtered by role — patients see their own, doctors see theirs, admins see all for their clinic). `POST` creates a new appointment with `createAppointmentSchema`.

---

#### `src/app/api/appointments/[id]/route.ts`

Single appointment operations. `PATCH` updates appointment status (`CONFIRMED`, `COMPLETED`, `MISSED`, `RESCHEDULED`, `CANCELLED`) with `updateAppointmentSchema`. `DELETE` cancels and removes the appointment.

---

#### `src/app/api/queue/route.ts`

Queue read and create. `GET` accepts `doctorId`, `departmentId`, and optional `date` as query params, calls `getActiveTickets()` and `enrichTicketsWithPosition()`, and returns the sorted, enriched ticket list. `POST` validates with `createQueueTicketSchema` and delegates to `createQueueTicket()` from the queue engine.

---

#### `src/app/api/queue/[ticketId]/route.ts`

Single ticket operations. `PATCH` validates with `updateQueueTicketSchema` and calls `updateTicketStatus()`. Also accepts optional `findings`, `prescription`, and `followUpDate` to update the `ConsultationRecord` created by the engine when status moves to `DONE`.

---

#### `src/app/api/queue/engine/route.ts`

Manual queue recalculation trigger. `POST` (restricted to `DOCTOR` and `ADMIN` roles) accepts `doctorId`, `departmentId`, `clinicId` and calls `recalculateQueue()`. Used to force a full re-sort and broadcast without a ticket status change — useful after capacity config updates or manual corrections.

---

#### `src/app/api/intake/route.ts`

Intake form submission. `POST` validates with `intakeSchema`, calls `getDocumentChecklist()` to derive the required documents from the chief complaint, and creates the `IntakeForm` record. Returns the form ID and document checklist to the client so it can be displayed immediately and passed to the queue ticket creation step.

---

#### `src/app/api/doctors/route.ts`

Doctor listing. `GET` returns doctors assigned to a clinic, with their active assignments and current day availability status. Used by the booking flow to populate the doctor selector.

---

#### `src/app/api/doctors/availability/route.ts`

Availability window management and HMO lane. The most multipurpose backend route:
- `GET` with `doctorId` / `clinicId` — returns upcoming availability windows
- `GET` with `hmoLane=true&clinicId=...` — returns all tickets with `loaStatus: PENDING` for HMO coordination
- `POST` with `action: "secureLoa"` — calls `secureLoa()` from the queue engine
- `POST` (standard) — creates a new availability window
- `PATCH` — updates window status; if `ABSENT`, delegates to `handleDoctorAbsent()`; if `DELAYED`, delegates to `handleDoctorDelayed()` with `delayMinutes`

---

#### `src/app/api/clinics/route.ts`

Clinic and department lookup. `GET` returns clinics with their departments and current capacity config. Used by booking and admin flows.

---

#### `src/app/api/notifications/route.ts`

Notification retrieval. `GET` returns the authenticated patient's recent notifications ordered by `sentAt DESC`. Supports `mark-read` via `PATCH` for individual notifications.

---

#### `src/app/api/announcements/route.ts`

Announcement management. `GET` (public) returns active announcements for a clinic — exempted from auth middleware so the landing page can display them. `POST` and `PATCH` are restricted to `ADMIN` role.

---

#### `src/app/api/admin/records/route.ts`

Admin consultation records access. Returns all `ConsultationRecord` entries for the admin's clinic with patient and doctor details joined.

---

#### `src/app/api/admin/reports/route.ts`

Daily report aggregation. Computes and returns: total tickets by type, tickets by status, no-show count, average wait time (from `calledAt` → `completedAt` deltas), and HMO pending count — all scoped to the admin's clinic and the current day.

---

#### `src/middleware.ts`

Next.js edge middleware. Runs before every request. Reads the JWT via `getToken()` and enforces role-based path protection without a database call. Redirects unauthenticated requests to `/login` with `callbackUrl` preserved. Protects `/patient/*`, `/doctor/*`, and `/admin/*` by role.

---

#### `prisma/schema.prisma`

The single source of truth for the database structure. Defines all models, enums, relations, and constraints. See [Data Model](#data-model) section for full entity breakdown.

---

#### `prisma/seed.ts`

Development seed script. Creates a demo clinic (KalQueue Community Health Center, Quezon City), two departments (General Medicine and Pediatrics), a capacity config, and four demo accounts (patient, HMO patient, doctor, admin) with `password123`. Run with `npm run db:seed`.

---

### System Design Layer

These are the files that make KalQueue what it is — the operational logic that would not exist in a generic clinic CRUD app.

---

#### `src/lib/queue-engine.ts`

The brain. Everything about how patients are ordered, how capacity is enforced, how wait times are computed, and how disruptions (absent/delayed doctors, LOA updates) are handled lives here.

**Exports and what they do:**

`computePriorityWeight(params)` — Pure function. Given a ticket's creation time, patient category, ticket type, and LOA status, returns a single Float that determines queue position. Earlier arrival + higher category = higher weight = earlier in queue.

`getAvgConsultDuration(doctorId)` — Queries the last 20 completed consultations for a specific doctor and computes average minutes from `calledAt` to `completedAt`. Returns `DEFAULT_CONSULT_DURATION` (8 minutes) if no history exists.

`getActiveTickets(doctorId, departmentId, date)` — Retrieves all `WAITING` or `IN_CONSULT` tickets for a doctor-department-date combination, excluding HMO tickets with `loaStatus: PENDING`. Ordered by `priorityWeight DESC`. Returns tickets with full patient, intake form, department, and doctor relations joined.

`enrichTicketsWithPosition(tickets, ...)` — Wraps a ticket list with dynamic `position` (1-indexed rank) and `estimatedWaitMinutes` (`position * avgDuration`). Position is not stored statically — it is computed at read time.

`checkCapacity(clinicId, doctorId, departmentId, type, date)` — Enforces capacity blocks. Checks the clinic's `ClinicCapacityConfig`, counts today's active tickets by type, and returns `{ allowed, overflow, message }`. If walk-in ratio is exceeded and the hard daily cap is hit, `overflow: true` is returned and the caller places the patient on `OverflowWaitlist`.

`createQueueTicket(input)` — Full ticket creation pipeline: capacity check → patient lookup → LOA status determination → priority weight computation → ticket insert → enrich with position → broadcast queue update via Pusher. Throws with a message if overflow — the API route catches this and returns a 409.

`updateTicketStatus(ticketId, status)` — Status transition with side effects: timestamps `calledAt` on `IN_CONSULT`, `completedAt` on `DONE`, auto-creates `ConsultationRecord` with prior summary on `DONE`, triggers post-visit SMS, sends position updates to patients in top 3, sends LOA reminders to HMO patients in top 5, broadcasts updated queue to all Pusher channels.

`handleDoctorAbsent(availabilityId)` — Marks availability window as `ABSENT`, bulk-updates all waiting tickets to `RESCHEDULED`, notifies all affected patients via SMS, attempts to find an alternate doctor in the same department, and re-creates tickets under the alternate if found.

`handleDoctorDelayed(availabilityId, delayMinutes)` — Marks window as `DELAYED`, recalculates each waiting ticket's estimated wait as `(position * avgDuration) + delayMinutes`, updates all records, notifies each patient via SMS with the new estimate, broadcasts updated estimates to clinic and doctor Pusher channels.

`secureLoa(ticketId)` — Validates the ticket is HMO category, recomputes priority weight with `LOAStatus.SECURED` (unlocking the +100 bonus), updates `loaStatus` and `loaSecuredAt`, broadcasts `loa:secured` to clinic and patient channels, triggers a full queue re-sort and broadcast.

`recalculateQueue(doctorId, departmentId, clinicId)` — Full re-sort: fetch active tickets, enrich with positions, update all `estimatedWaitMinutes` in database, broadcast to Pusher. Called by the `/api/queue/engine` endpoint.

---

#### `src/lib/notifications.ts`

All outbound communication. Dual-channel: every notification writes to the `Notification` database table (in-app) and attempts an SMS via Twilio simultaneously.

The Twilio client is lazy-initialized and returns `null` if credentials are missing — the system degrades gracefully to console logging without throwing. This means the app runs fully in development without Twilio configured.

Named exports map one-to-one with queue lifecycle events:

| Function | Trigger |
|---|---|
| `notifyBookingConfirmed` | New ticket or appointment created |
| `notifyQueueReminder` | 24h before appointment (cron-triggered) |
| `notifyQueuePositionUpdate` | Patient reaches top 3 in queue |
| `notifyDoctorDelayed` | Doctor marks availability as DELAYED |
| `notifyDoctorAbsent` | Doctor marks availability as ABSENT |
| `notifyLoaReminder` | HMO patient reaches top 5 with LOA still pending |
| `notifyPostVisit` | Ticket status moves to DONE |

All SMS bodies are in plain English but are structured to be understood with minimal literacy — short sentences, specific numbers, direct action items. The system is designed to be extended to Tagalog/Cebuano message templates based on the patient's `languagePreference`.

---

#### `src/lib/pusher.ts`

Real-time event bus. Server-side (`Pusher`) and client-side (`PusherClient`) are both initialized here and lazy-loaded — the server instance is a singleton, the client is created fresh per component mount.

Three channel namespaces are used:

| Channel | Who subscribes | Events received |
|---|---|---|
| `clinic-{clinicId}` | Admin dashboard, clinic display boards | `queue:updated`, `queue:called`, `doctor:delayed`, `doctor:absent`, `loa:secured` |
| `doctor-{doctorId}` | Doctor dashboard | `queue:updated`, `queue:called`, `doctor:delayed`, `doctor:absent` |
| `patient-{patientId}` | Patient queue view | `queue:called`, `loa:secured` |

All broadcasts are `async/await` and wrapped in null guards — if Pusher credentials are not configured, the functions return silently without throwing.

---

#### `src/lib/auth.ts`

NextAuth v5 configuration. Uses a credentials provider with bcrypt password verification. On successful login, the JWT is populated with: `id`, `role`, `firstName`, `lastName`, `clinicId`, `patientId`, `doctorId`, `adminId` — the role-specific profile IDs are read from the database once at login and cached in the JWT, eliminating per-request profile lookups in API routes.

The TypeScript module augmentations at the top of this file extend NextAuth's `Session` and `JWT` types to include KalQueue-specific fields — this is what makes `session.user.role`, `session.user.doctorId`, etc. type-safe across the codebase.

---

#### `src/lib/validations.ts`

All Zod schemas and the document checklist logic. Every API route that accepts input validates against one of the schemas defined here before touching the database.

The `DOCUMENT_CHECKLIST_MAP` is a key part of the intake system — it maps normalized complaint strings to required document arrays. `getDocumentChecklist(chiefComplaint)` normalizes the input and pattern-matches against the map. This is where the balik-balik prevention is implemented: documents are surfaced before the patient enters the queue, not after they are already waiting.

The type exports at the bottom (`LoginInput`, `RegisterInput`, `IntakeInput`, etc.) are used for type safety across the API routes without duplicating field definitions.

---

#### `src/lib/prisma.ts`

Prisma client singleton. Uses the `globalThis` pattern to prevent connection pool exhaustion during Next.js hot-reloads in development — a single `PrismaClient` instance is shared across all module reloads. In production, a fresh instance is created per serverless function invocation.

---

#### `src/components/queue-ticker.tsx`

The live queue display component. A client component that subscribes to Pusher channels at mount and updates reactively to queue events without polling.

Accepts `clinicId`, `doctorId`, `patientId`, and `ticketId` props to subscribe to the appropriate channels. Renders in three modes:
- **Single ticket (full)** — patient's own queue card: position, estimated wait, status, navigation instructions to their department
- **Single ticket (compact)** — inline summary for dashboard widgets
- **Ticket list** — doctor/admin view of the full queue ordered by position

The live indicator (green pulsing dot + "Live Updates" label) is shown only when the Pusher subscription is confirmed, giving users a clear signal that their view is real-time.

---

#### `src/components/intake-form.tsx`

The structured intake flow. A client component that presents a fixed set of visit-reason options (General Checkup, School Medical, Travel/Visa, HMO Consultation, Government Assisted) and a language preference selector (English, Tagalog, Cebuano, Ilocano).

On submit, it posts to `/api/intake` and immediately displays the returned `documentChecklist` to the patient in an amber notice box. This is the moment the patient learns what to bring — before their number is called, while they can still retrieve documents.

The `onComplete` callback returns the `intakeFormId` and checklist to the parent booking flow, which then passes the `intakeFormId` into the queue ticket creation step, linking the intake record to the ticket.

---

## Environment Variables

```env
# Database
DATABASE_URL=           # PostgreSQL connection string (pooled, for Prisma queries)
DIRECT_URL=             # PostgreSQL direct connection string (for migrations)

# Auth
AUTH_SECRET=            # NextAuth secret — generate with: openssl rand -base64 32
NEXTAUTH_URL=           # Full base URL of the app (e.g. http://localhost:3000)

# Pusher (real-time)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=ap1      # Southeast Asia cluster — use ap1 for PH deployment
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=ap1

# Twilio (SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=    # E.164 format: +1XXXXXXXXXX
```

Twilio and Pusher credentials are optional in development. The system falls back to console logging for SMS and skips real-time broadcasts silently. The core queue logic, database operations, and authentication work fully without them.

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment variables
cp .env.example .env.local

# 3. Push schema to database
npm run db:push

# 4. Seed demo data
npm run db:seed

# 5. Start dev server
npm run dev
```

**Demo accounts** (password: `password123`)

| Role | Email |
|---|---|
| Patient (Regular) | `patient@kalqueue.ph` |
| Patient (HMO — Maxicare) | `hmo@kalqueue.ph` |
| Doctor | `doctor@kalqueue.ph` |
| Admin | `admin@kalqueue.ph` |

The seed creates KalQueue Community Health Center in Quezon City with General Medicine and Pediatrics departments, a default capacity config (60/40 appointment/walk-in ratio, 50 max daily walk-ins), and an active availability window for today.
