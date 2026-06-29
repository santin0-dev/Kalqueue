import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z
  .object({
    email: z.string().email("Valid email required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    role: z.enum(["PATIENT", "DOCTOR", "ADMIN"]),
    firstName: z.string().min(1, "First name required"),
    lastName: z.string().min(1, "Last name required"),
    inviteCode: z.string().optional(),
    dateOfBirth: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    category: z
      .enum([
        "REGULAR",
        "PWD",
        "SENIOR",
        "PREGNANT",
        "HMO",
        "GOVERNMENT_ASSISTED",
      ])
      .optional(),
    specialty: z.string().optional(),
    licenseNumber: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      if (data.role === "PATIENT") {
        return !!data.dateOfBirth && !!data.phone && !!data.address;
      }
      return true;
    },
    { message: "Patient registration requires date of birth, phone, and address" }
  )
  .refine(
    (data) => {
      if (data.role === "PATIENT") {
        return !!data.dateOfBirth && !Number.isNaN(new Date(data.dateOfBirth).getTime());
      }
      return true;
    },
    { message: "Patient registration requires a valid date of birth" }
  )
  .refine(
    (data) => {
      if (data.role === "DOCTOR") {
        return !!data.specialty && !!data.licenseNumber && !!data.phone;
      }
      return true;
    },
    { message: "Doctor registration requires specialty, license, and phone" }
  );

export const intakeSchema = z.object({
  chiefComplaint: z.string().min(1, "Chief complaint required"),
  patientId: z.string().min(1),
  languagePreference: z.string().optional(),
  notes: z.string().optional(),
});

export const createQueueTicketSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  clinicId: z.string().min(1),
  departmentId: z.string().min(1),
  type: z.enum(["APPOINTMENT", "WALKIN"]),
  intakeFormId: z.string().optional(),
});

export const updateQueueTicketSchema = z.object({
  status: z.enum(["IN_CONSULT", "DONE", "NO_SHOW", "RESCHEDULED", "CANCELLED"]),
  findings: z.string().optional(),
  prescription: z.string().optional(),
  followUpDate: z.string().optional(),
});

export const queueQuerySchema = z.object({
  doctorId: z.string().min(1),
  departmentId: z.string().min(1),
  date: z.string().optional(),
});

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  clinicId: z.string().min(1),
  departmentId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "COMPLETED",
    "MISSED",
    "RESCHEDULED",
    "CANCELLED",
  ]),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const availabilitySchema = z.object({
  doctorId: z.string().min(1),
  clinicId: z.string().min(1),
  departmentId: z.string().min(1),
  date: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const updateAvailabilitySchema = z.object({
  status: z.enum(["DELAYED", "ABSENT", "ACTIVE", "DONE"]),
  delayMinutes: z.number().int().min(0).optional(),
});

export const updatePatientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  category: z
    .enum([
      "REGULAR",
      "PWD",
      "SENIOR",
      "PREGNANT",
      "HMO",
      "GOVERNMENT_ASSISTED",
    ])
    .optional(),
  languagePreference: z.string().optional(),
  hmoProvider: z.string().optional(),
  hmoMemberNumber: z.string().optional(),
});

export const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const capacityConfigSchema = z.object({
  clinicId: z.string().min(1),
  appointmentRatio: z.number().min(0).max(1).optional(),
  walkinRatio: z.number().min(0).max(1).optional(),
  blockSize: z.number().int().min(1).optional(),
  maxDailyWalkins: z.number().int().min(1).optional(),
});

export const doctorAssignmentSchema = z.object({
  doctorId: z.string().min(1),
  clinicId: z.string().min(1),
  departmentId: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const updateDoctorProfileSchema = z.object({
  signatureImage: z.string().max(2_000_000).nullable().optional(),
});

export const loaSecureSchema = z.object({
  ticketId: z.string().min(1),
});

export const consultationRecordSchema = z.object({
  queueTicketId: z.string().min(1),
  findings: z.string().optional(),
  prescription: z.string().optional(),
  followUpDate: z.string().optional(),
});

export const DOCUMENT_CHECKLIST_MAP: Record<string, string[]> = {
  "school medical": [
    "birth certificate",
    "school ID",
    "parent consent if minor",
  ],
  "travel visa": ["passport", "travel itinerary", "vaccination records"],
  "general checkup": ["valid ID", "previous lab results if any"],
  "HMO consult": ["HMO card", "valid ID", "referral letter if specialist"],
  "government assisted": [
    "PhilHealth card or MDR",
    "valid ID",
    "Malasakit referral if applicable",
  ],
};

export function getDocumentChecklist(chiefComplaint: string): string[] {
  const normalized = chiefComplaint.toLowerCase().trim();
  for (const [key, docs] of Object.entries(DOCUMENT_CHECKLIST_MAP)) {
    if (normalized.includes(key)) return docs;
  }
  return ["valid ID"];
}

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type IntakeInput = z.infer<typeof intakeSchema>;
export type CreateQueueTicketInput = z.infer<typeof createQueueTicketSchema>;
export type UpdateQueueTicketInput = z.infer<typeof updateQueueTicketSchema>;
