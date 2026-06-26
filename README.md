# KalQueue

Multi-stakeholder clinic operations platform for Philippine clinics and community hospitals.

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Prisma ORM + PostgreSQL
- NextAuth.js v5 (credentials, role-based sessions)
- Pusher (real-time queue updates)
- Twilio (SMS notifications)
- Zod (validation)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 3. Set up database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Accounts

After seeding, use these accounts (password: `password123`):

| Role    | Email               |
|---------|---------------------|
| Patient | patient@kalqueue.ph |
| HMO     | hmo@kalqueue.ph     |
| Doctor  | doctor@kalqueue.ph  |
| Admin   | admin@kalqueue.ph   |

## Invite Codes (Registration)

- Doctor: set `DOCTOR_INVITE_CODE` in `.env` (default: `doctor-invite-2024`)
- Admin: set `ADMIN_INVITE_CODE` in `.env` (default: `admin-invite-2024`)

## Project Structure

See the blueprint in the project documentation for full folder structure and API design.

## Key Features

- Dynamic priority queue (position never stored in DB)
- HMO parallel LOA lane
- Capacity block enforcement (appointment/walk-in ratios)
- Real-time Pusher updates
- SMS notifications via Twilio
- Role-based dashboards (Patient, Doctor, Admin)
