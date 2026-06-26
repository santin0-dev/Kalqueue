import Pusher from "pusher";
import PusherClient from "pusher-js";

let pusherServer: Pusher | null = null;

export function getPusherServer(): Pusher | null {
  if (
    !process.env.PUSHER_APP_ID ||
    !process.env.PUSHER_KEY ||
    !process.env.PUSHER_SECRET
  ) {
    return null;
  }

  if (!pusherServer) {
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER ?? "ap1",
      useTLS: true,
    });
  }

  return pusherServer;
}

export function createPusherClient(): PusherClient | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "ap1";

  if (!key) return null;

  return new PusherClient(key, { cluster });
}

export async function broadcastQueueUpdate(
  clinicId: string,
  doctorId: string,
  departmentId: string,
  tickets: unknown[]
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;

  const payload = { doctorId, departmentId, tickets };

  await Promise.all([
    pusher.trigger(`clinic-${clinicId}`, "queue:updated", payload),
    pusher.trigger(`doctor-${doctorId}`, "queue:updated", payload),
  ]);
}

export async function broadcastQueueCalled(
  clinicId: string,
  doctorId: string,
  patientId: string,
  ticketId: string
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;

  const payload = { ticketId, patientId, position: 1 };

  await Promise.all([
    pusher.trigger(`clinic-${clinicId}`, "queue:called", payload),
    pusher.trigger(`doctor-${doctorId}`, "queue:called", payload),
    pusher.trigger(`patient-${patientId}`, "queue:called", payload),
  ]);
}

export async function broadcastDoctorDelayed(
  clinicId: string,
  doctorId: string,
  delayMinutes: number,
  newEstimates: { ticketId: string; estimatedWaitMinutes: number }[]
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;

  const payload = { doctorId, delayMinutes, newEstimates };

  await Promise.all([
    pusher.trigger(`clinic-${clinicId}`, "doctor:delayed", payload),
    pusher.trigger(`doctor-${doctorId}`, "doctor:delayed", payload),
  ]);
}

export async function broadcastDoctorAbsent(
  clinicId: string,
  doctorId: string,
  affectedTickets: { ticketId: string; patientId: string }[]
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;

  const payload = { doctorId, affectedTickets };

  await Promise.all([
    pusher.trigger(`clinic-${clinicId}`, "doctor:absent", payload),
    pusher.trigger(`doctor-${doctorId}`, "doctor:absent", payload),
  ]);
}

export async function broadcastLoaSecured(
  clinicId: string,
  ticketId: string,
  patientId: string
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;

  const payload = { ticketId, patientId };

  await Promise.all([
    pusher.trigger(`clinic-${clinicId}`, "loa:secured", payload),
    pusher.trigger(`patient-${patientId}`, "loa:secured", payload),
  ]);
}
