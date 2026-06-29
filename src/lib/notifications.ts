import twilio from "twilio";
import { NotificationChannel } from "@prisma/client";
import { prisma } from "./prisma";

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN
  ) {
    return null;
  }
  if (!process.env.TWILIO_ACCOUNT_SID.startsWith("AC")) {
    console.warn("Twilio SMS disabled: TWILIO_ACCOUNT_SID must start with AC.");
    return null;
  }
  if (!twilioClient) {
    try {
      twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } catch (err) {
      console.error("Twilio client setup error:", err);
      return null;
    }
  }
  return twilioClient;
}

async function sendSms(phone: string, body: string): Promise<boolean> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !from) {
    console.log(`[SMS mock] To: ${phone} — ${body}`);
    return false;
  }

  try {
    await client.messages.create({ body, from, to: phone });
    return true;
  } catch (err) {
    console.error("Twilio SMS error:", err);
    return false;
  }
}

async function createInAppNotification(params: {
  patientId: string;
  title: string;
  body: string;
  triggeredBy: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      patientId: params.patientId,
      channel: NotificationChannel.IN_APP,
      title: params.title,
      body: params.body,
      triggeredBy: params.triggeredBy,
    },
  });
}

async function notify(params: {
  patientId: string;
  phone: string;
  title: string;
  body: string;
  triggeredBy: string;
}): Promise<void> {
  try {
    await sendSms(params.phone, params.body);
  } catch (err) {
    console.error("SMS notification error:", err);
  }

  try {
    await createInAppNotification({
      patientId: params.patientId,
      title: params.title,
      body: params.body,
      triggeredBy: params.triggeredBy,
    });
  } catch (err) {
    console.error("In-app notification error:", err);
  }
}

export async function notifyBookingConfirmed(params: {
  patientId: string;
  phone: string;
  clinicName: string;
  date: string;
  documentChecklist: string[];
  ticketId: string;
}): Promise<void> {
  const docs = params.documentChecklist.join(", ");
  const body = `KalQueue: Your appointment at ${params.clinicName} is confirmed for ${params.date}. Please bring: ${docs}. Your queue ticket: ${params.ticketId}.`;

  await notify({
    patientId: params.patientId,
    phone: params.phone,
    title: "Appointment Confirmed",
    body,
    triggeredBy: "BOOKING_CONFIRMED",
  });
}

export async function notifyQueueReminder(params: {
  patientId: string;
  phone: string;
  clinicName: string;
  estimatedWait: number;
}): Promise<void> {
  const body = `KalQueue: Reminder — your appointment at ${params.clinicName} is tomorrow. Current estimated wait: ${params.estimatedWait} mins. Bring your documents.`;

  await notify({
    patientId: params.patientId,
    phone: params.phone,
    title: "Appointment Reminder",
    body,
    triggeredBy: "QUEUE_REMINDER",
  });
}

export async function notifyQueuePositionUpdate(params: {
  patientId: string;
  phone: string;
  position: number;
  estimatedWait: number;
  clinicName: string;
  department: string;
  floor: string;
  building: string;
}): Promise<void> {
  const body = `KalQueue: You are now #${params.position} in line at ${params.clinicName}. Estimated wait: ${params.estimatedWait} mins. Please proceed to ${params.department}, ${params.floor} ${params.building}.`;

  await notify({
    patientId: params.patientId,
    phone: params.phone,
    title: "Queue Position Update",
    body,
    triggeredBy: "QUEUE_POSITION_UPDATE",
  });
}

export async function notifyDoctorDelayed(params: {
  patientId: string;
  phone: string;
  doctorName: string;
  delayMinutes: number;
  newTime: string;
}): Promise<void> {
  const body = `KalQueue: ${params.doctorName} is delayed by ${params.delayMinutes} mins. Your new estimated time is ${params.newTime}. Your position is held.`;

  await notify({
    patientId: params.patientId,
    phone: params.phone,
    title: "Doctor Delayed",
    body,
    triggeredBy: "DOCTOR_DELAYED",
  });
}

export async function notifyDoctorAbsent(params: {
  patientId: string;
  phone: string;
  doctorName: string;
}): Promise<void> {
  const body = `KalQueue: ${params.doctorName} is unavailable today. Your ticket has been rescheduled. We will contact you with a new slot.`;

  await notify({
    patientId: params.patientId,
    phone: params.phone,
    title: "Doctor Unavailable",
    body,
    triggeredBy: "DOCTOR_ABSENT",
  });
}

export async function notifyLoaReminder(params: {
  patientId: string;
  phone: string;
  position: number;
}): Promise<void> {
  const body = `KalQueue: You are #${params.position} in line. Please ensure your LOA is ready. Proceed to the HMO counter if not yet secured.`;

  await notify({
    patientId: params.patientId,
    phone: params.phone,
    title: "LOA Reminder",
    body,
    triggeredBy: "LOA_REMINDER",
  });
}

export async function notifyPostVisit(params: {
  patientId: string;
  phone: string;
  clinicName: string;
  followUpDate: string | null;
}): Promise<void> {
  const followUp = params.followUpDate ?? "none";
  const body = `KalQueue: Thank you for your visit to ${params.clinicName}. Your consultation record is available on your dashboard. Follow-up: ${followUp}.`;

  await notify({
    patientId: params.patientId,
    phone: params.phone,
    title: "Thank You for Your Visit",
    body,
    triggeredBy: "POST_VISIT",
  });
}

export async function getPatientNotifications(patientId: string, limit = 10) {
  return prisma.notification.findMany({
    where: { patientId },
    orderBy: { sentAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}
