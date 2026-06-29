# KalQueue

KalQueue is a staged clinic queue and records system built for Philippine clinics. It connects patient intake, live queue tracking, doctor consultation, admin monitoring, reports, backups, and AI-assisted charting into one workflow.

## The Airport Stage System

Clinics are not bank queues. A clinic visit has stages:

```txt
Intake -> Documents / LOA -> Queue -> Doctor Call-In -> Consultation -> Post-Checkup Records
```

If one stage is delayed, the patient is still inside the care flow. KalQueue keeps that flow visible to patients, doctors, and admins.

## Main Roles

- **Patient**: books a visit, tracks queue position, receives notifications, views checkup history, prescriptions, and doctor recommendations.
- **Doctor**: sees live queue, calls patients in, completes consultations, records findings, and can attach an e-signature for prescriptions.
- **Admin**: monitors clinic operations, handles HMO/LOA flow, views records, downloads reports, and creates backups.

## Core Features

- Live queue tracking with patient position and estimated wait time
- Priority-aware queueing for seniors, PWD, pregnant patients, HMO, and walk-ins
- Doctor call-in and consultation completion
- Post-checkup recommendations popup for patients
- Patient checkup history with prescriptions and doctor e-signature
- Admin reports download as CSV
- Admin backup download as JSON
- Mobile-friendly dashboard navigation
- In-app notifications page for patients
- Optional local AI charting with Whisper + Ollama

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Supabase PostgreSQL with Prisma
- **Auth**: NextAuth credentials with role-based sessions
- **Realtime**: Pusher
- **Optional SMS**: Twilio
- **Optional Local AI**: Whisper for transcription, Ollama for chart formatting
- **Deployment**: Vercel

## Database Gist

The database is relational because clinic data is connected.

Important entities:

- `User`: login account
- `Patient`, `Doctor`, `Admin`: role profiles
- `Clinic`, `Department`: clinic structure
- `QueueTicket`: the active clinic journey
- `IntakeForm`: patient visit reason and documents
- `ConsultationRecord`: findings, prescription, follow-up, history
- `Notification`: patient updates
- `AvailabilityWindow`: doctor schedule/availability

Most of the system connects through `QueueTicket`, because it links the patient, doctor, clinic, department, queue status, and consultation record.

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Demo Accounts

Password for all seeded accounts:

```txt
password123
```

| Role | Email |
| --- | --- |
| Patient | patient@kalqueue.ph |
| HMO Patient | hmo@kalqueue.ph |
| Doctor | doctor@kalqueue.ph |
| Admin | admin@kalqueue.ph |

## Registration Invite Codes

Defaults:

```txt
Doctor: doctor-invite-2024
Admin: admin-invite-2024
```

For real deployment, set private values in Vercel:

```txt
DOCTOR_INVITE_CODE
ADMIN_INVITE_CODE
```

## Local AI Charting

The doctor can record a patient reply. The local AI service:

```txt
Audio -> Whisper transcript -> Ollama improved charting -> Doctor review -> Save record
```

Run it locally:

```bash
cd local-ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
ollama pull llama3.2:1b
python server.py
```

The app calls:

```txt
http://localhost:8765
```

Use short recordings for faster demo performance.

## Deployment

Before deploying after schema changes:

```bash
npx prisma db push
```

Then deploy:

```bash
npm run build
npx vercel --prod
```

## One-Line Summary

KalQueue turns the clinic visit into a visible staged journey, so patients know where they are, doctors know who to call next, and admins can monitor, report, and preserve the post-checkup record.
