import {
  PatientCategory,
  TicketStatus,
  TicketType,
  LOAStatus,
  AvailabilityStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import {
  broadcastDoctorAbsent,
  broadcastDoctorDelayed,
  broadcastLoaSecured,
  broadcastQueueUpdate,
} from "./pusher";
import {
  notifyDoctorAbsent,
  notifyDoctorDelayed,
  notifyLoaReminder,
  notifyPostVisit,
  notifyQueuePositionUpdate,
} from "./notifications";

const DEFAULT_CONSULT_DURATION = 8;
const CATEGORY_BONUS = {
  PREGNANT: 300,
  PWD: 300,
  SENIOR: 300,
  HMO: 0,
  REGULAR: 0,
  GOVERNMENT_ASSISTED: 0,
} as const;

const APPOINTMENT_BONUS = 200;

export interface QueueTicketWithRelations {
  id: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  departmentId: string;
  type: TicketType;
  status: TicketStatus;
  priorityWeight: number;
  estimatedWaitMinutes: number;
  loaStatus: LOAStatus;
  createdAt: Date;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    category: PatientCategory;
    phone: string;
    languagePreference: string;
  };
  intakeForm?: {
    chiefComplaint: string;
    languageFlag: string | null;
  } | null;
  department: {
    name: string;
    floor: string;
    building: string;
    navigationInstructions: string;
  };
  doctor: {
    firstName: string;
    lastName: string;
  };
}

export interface EnrichedTicket extends QueueTicketWithRelations {
  position: number;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function computePriorityWeight(params: {
  createdAt: Date;
  category: PatientCategory;
  type: TicketType;
  loaStatus: LOAStatus;
  appointmentConfirmed?: boolean;
}): number {
  const baseScore = 1_000_000_000_000 - params.createdAt.getTime();
  let categoryBonus: number = CATEGORY_BONUS[params.category] ?? 0;

  if (params.category === PatientCategory.HMO && params.loaStatus === LOAStatus.SECURED) {
    categoryBonus = 100;
  }

  let typeBonus = 0;
  if (params.type === TicketType.APPOINTMENT && params.appointmentConfirmed !== false) {
    typeBonus = APPOINTMENT_BONUS;
  }

  return baseScore + categoryBonus + typeBonus;
}

export async function getAvgConsultDuration(doctorId: string): Promise<number> {
  const records = await prisma.consultationRecord.findMany({
    where: { doctorId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      queueTicket: {
        select: { calledAt: true, completedAt: true },
      },
    },
  });

  const durations = records
    .map((r) => {
      const called = r.queueTicket.calledAt;
      const completed = r.queueTicket.completedAt;
      if (!called || !completed) return null;
      return (completed.getTime() - called.getTime()) / 60000;
    })
    .filter((d): d is number => d !== null && d > 0);

  if (durations.length === 0) return DEFAULT_CONSULT_DURATION;

  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

export async function getActiveTickets(
  doctorId: string,
  departmentId: string,
  date: Date
): Promise<QueueTicketWithRelations[]> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const tickets = await prisma.queueTicket.findMany({
    where: {
      doctorId,
      departmentId,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: { in: [TicketStatus.WAITING, TicketStatus.IN_CONSULT] },
      OR: [
        { loaStatus: { not: LOAStatus.PENDING } },
        { loaStatus: LOAStatus.SECURED },
      ],
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          category: true,
          phone: true,
          languagePreference: true,
        },
      },
      intakeForm: {
        select: { chiefComplaint: true, languageFlag: true },
      },
      department: {
        select: {
          name: true,
          floor: true,
          building: true,
          navigationInstructions: true,
        },
      },
      doctor: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { priorityWeight: "desc" },
  });

  return tickets;
}

export async function getQueuePosition(
  ticketId: string,
  doctorId: string,
  departmentId: string,
  date: Date
): Promise<number> {
  const tickets = await getActiveTickets(doctorId, departmentId, date);
  const index = tickets.findIndex((t) => t.id === ticketId);
  return index === -1 ? 0 : index + 1;
}

export async function enrichTicketsWithPosition(
  tickets: QueueTicketWithRelations[],
  doctorId: string,
  departmentId: string,
  date: Date
): Promise<EnrichedTicket[]> {
  const avgDuration = await getAvgConsultDuration(doctorId);
  const sorted = [...tickets].sort((a, b) => b.priorityWeight - a.priorityWeight);

  return sorted.map((ticket, index) => ({
    ...ticket,
    position: index + 1,
    estimatedWaitMinutes: (index + 1) * avgDuration,
  }));
}

export async function enrichSingleTicket(
  ticket: QueueTicketWithRelations,
  date: Date
): Promise<EnrichedTicket> {
  const enriched = await enrichTicketsWithPosition(
    [ticket],
    ticket.doctorId,
    ticket.departmentId,
    date
  );
  const allTickets = await getActiveTickets(
    ticket.doctorId,
    ticket.departmentId,
    date
  );
  const enrichedAll = await enrichTicketsWithPosition(
    allTickets,
    ticket.doctorId,
    ticket.departmentId,
    date
  );
  const found = enrichedAll.find((t) => t.id === ticket.id);
  return found ?? enriched[0];
}

export interface CapacityCheckResult {
  allowed: boolean;
  overflow: boolean;
  message?: string;
}

export async function checkCapacity(
  clinicId: string,
  doctorId: string,
  departmentId: string,
  type: TicketType,
  date: Date
): Promise<CapacityCheckResult> {
  const config = await prisma.clinicCapacityConfig.findUnique({
    where: { clinicId },
  });

  const appointmentRatio = config?.appointmentRatio ?? 0.6;
  const walkinRatio = config?.walkinRatio ?? 0.4;
  const maxDailyWalkins = config?.maxDailyWalkins ?? 50;

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const activeTickets = await prisma.queueTicket.count({
    where: {
      clinicId,
      doctorId,
      departmentId,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: { in: [TicketStatus.WAITING, TicketStatus.IN_CONSULT] },
    },
  });

  const walkinCount = await prisma.queueTicket.count({
    where: {
      clinicId,
      doctorId,
      departmentId,
      type: TicketType.WALKIN,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: { in: [TicketStatus.WAITING, TicketStatus.IN_CONSULT] },
    },
  });

  const appointmentCount = await prisma.queueTicket.count({
    where: {
      clinicId,
      doctorId,
      departmentId,
      type: TicketType.APPOINTMENT,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: { in: [TicketStatus.WAITING, TicketStatus.IN_CONSULT] },
    },
  });

  if (type === TicketType.WALKIN) {
    const totalWalkinsToday = await prisma.queueTicket.count({
      where: {
        clinicId,
        type: TicketType.WALKIN,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
    });

    if (totalWalkinsToday >= maxDailyWalkins) {
      return { allowed: false, overflow: true, message: "Daily walk-in limit reached" };
    }

    if (activeTickets > 0 && walkinCount / activeTickets > walkinRatio) {
      return { allowed: false, overflow: true, message: "Walk-in capacity block full" };
    }
  }

  if (type === TicketType.APPOINTMENT && activeTickets > 0) {
    if (appointmentCount / activeTickets > appointmentRatio) {
      return {
        allowed: false,
        overflow: false,
        message: "Appointment capacity block full — try next block",
      };
    }
  }

  return { allowed: true, overflow: false };
}

export interface CreateTicketInput {
  patientId: string;
  doctorId: string;
  clinicId: string;
  departmentId: string;
  type: TicketType;
  intakeFormId?: string;
}

export async function createQueueTicket(
  input: CreateTicketInput
): Promise<{ ticket: EnrichedTicket; overflow: boolean }> {
  const date = new Date();
  const capacity = await checkCapacity(
    input.clinicId,
    input.doctorId,
    input.departmentId,
    input.type,
    date
  );

  if (!capacity.allowed && capacity.overflow) {
    await prisma.overflowWaitlist.create({
      data: {
        patientId: input.patientId,
        doctorId: input.doctorId,
        clinicId: input.clinicId,
        departmentId: input.departmentId,
        type: input.type,
        intakeFormId: input.intakeFormId,
      },
    });
    throw new Error(capacity.message ?? "Added to overflow waitlist");
  }

  if (!capacity.allowed) {
    throw new Error(capacity.message ?? "Capacity limit reached");
  }

  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
  });

  if (!patient) throw new Error("Patient not found");

  const loaStatus =
    patient.category === PatientCategory.HMO ? LOAStatus.PENDING : LOAStatus.NOT_REQUIRED;

  const priorityWeight = computePriorityWeight({
    createdAt: date,
    category: patient.category,
    type: input.type,
    loaStatus,
    appointmentConfirmed: input.type === TicketType.APPOINTMENT,
  });

  const activeAheadCount = await prisma.queueTicket.count({
    where: {
      clinicId: input.clinicId,
      doctorId: input.doctorId,
      departmentId: input.departmentId,
      createdAt: { gte: startOfDay(date), lte: endOfDay(date) },
      status: { in: [TicketStatus.WAITING, TicketStatus.IN_CONSULT] },
      priorityWeight: { gt: priorityWeight },
      OR: [
        { loaStatus: { not: LOAStatus.PENDING } },
        { loaStatus: LOAStatus.SECURED },
      ],
    },
  });
  const estimatedWaitMinutes = (activeAheadCount + 1) * DEFAULT_CONSULT_DURATION;

  const ticket = await prisma.queueTicket.create({
    data: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      departmentId: input.departmentId,
      type: input.type,
      intakeFormId: input.intakeFormId,
      priorityWeight,
      loaStatus,
      estimatedWaitMinutes,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          category: true,
          phone: true,
          languagePreference: true,
        },
      },
      intakeForm: {
        select: { chiefComplaint: true, languageFlag: true },
      },
      department: {
        select: {
          name: true,
          floor: true,
          building: true,
          navigationInstructions: true,
        },
      },
      doctor: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  const enriched = {
    ...ticket,
    position: activeAheadCount + 1,
    estimatedWaitMinutes,
  };

  recalculateQueue(input.doctorId, input.departmentId, input.clinicId).catch((err) => {
    console.error("Queue recalculation after ticket creation failed:", err);
  });

  return { ticket: enriched, overflow: false };
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<EnrichedTicket> {
  const date = new Date();

  const existing = await prisma.queueTicket.findUnique({
    where: { id: ticketId },
    select: {
      doctorId: true,
      patientId: true,
    },
  });

  if (!existing) throw new Error("Ticket not found");

  const result = await prisma.queueTicket.update({
    where: { id: ticketId },
    data: {
      status,
      calledAt: status === TicketStatus.IN_CONSULT ? new Date() : undefined,
      completedAt: status === TicketStatus.DONE ? new Date() : undefined,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          category: true,
          phone: true,
          languagePreference: true,
        },
      },
      intakeForm: {
        select: { chiefComplaint: true, languageFlag: true },
      },
      department: {
        select: {
          name: true,
          floor: true,
          building: true,
          navigationInstructions: true,
        },
      },
      doctor: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  if (status === TicketStatus.DONE) {
    const priorRecord = await prisma.consultationRecord.findFirst({
      where: {
        patientId: existing.patientId,
        queueTicketId: { not: ticketId },
      },
      orderBy: { createdAt: "desc" },
    });

    await prisma.consultationRecord.upsert({
      where: { queueTicketId: ticketId },
      create: {
        queueTicketId: ticketId,
        doctorId: existing.doctorId,
        patientId: existing.patientId,
        priorSummary: priorRecord?.findings ?? "",
      },
      update: {},
    });
  }

  const enriched = await enrichSingleTicket(result, date);

  const allTickets = await getActiveTickets(
    result.doctorId,
    result.departmentId,
    date
  );
  const enrichedAll = await enrichTicketsWithPosition(
    allTickets,
    result.doctorId,
    result.departmentId,
    date
  );

  await broadcastQueueUpdate(
    result.clinicId,
    result.doctorId,
    result.departmentId,
    enrichedAll
  );

  if (status === TicketStatus.DONE) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: result.clinicId },
    });
    await notifyPostVisit({
      patientId: result.patientId,
      phone: result.patient.phone,
      clinicName: clinic?.name ?? "Clinic",
      followUpDate: null,
    });
  }

  if (status !== TicketStatus.IN_CONSULT) {
    for (const t of enrichedAll) {
      if (t.position <= 3) {
        const clinic = await prisma.clinic.findUnique({
          where: { id: t.clinicId },
        });
        await notifyQueuePositionUpdate({
          patientId: t.patientId,
          phone: t.patient.phone,
          position: t.position,
          estimatedWait: t.estimatedWaitMinutes,
          clinicName: clinic?.name ?? "Clinic",
          department: t.department.name,
          floor: t.department.floor,
          building: t.department.building,
        });
      }
      if (t.patient.category === PatientCategory.HMO && t.position <= 5) {
        await notifyLoaReminder({
          patientId: t.patientId,
          phone: t.patient.phone,
          position: t.position,
        });
      }
    }
  }

  return enriched;
}

export async function handleDoctorAbsent(
  availabilityId: string
): Promise<void> {
  const window = await prisma.availabilityWindow.findUnique({
    where: { id: availabilityId },
    include: { doctor: true, clinic: true },
  });

  if (!window) throw new Error("Availability window not found");

  const date = window.date;
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const affectedTickets = await prisma.queueTicket.findMany({
    where: {
      doctorId: window.doctorId,
      departmentId: window.departmentId,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: TicketStatus.WAITING,
    },
    include: { patient: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.availabilityWindow.update({
      where: { id: availabilityId },
      data: { status: AvailabilityStatus.ABSENT },
    });

    for (const ticket of affectedTickets) {
      await tx.queueTicket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.RESCHEDULED },
      });
    }
  });

  const affectedPayload = affectedTickets.map((t) => ({
    ticketId: t.id,
    patientId: t.patientId,
  }));

  await broadcastDoctorAbsent(
    window.clinicId,
    window.doctorId,
    affectedPayload
  );

  for (const ticket of affectedTickets) {
    await notifyDoctorAbsent({
      patientId: ticket.patientId,
      phone: ticket.patient.phone,
      doctorName: `Dr. ${window.doctor.firstName} ${window.doctor.lastName}`,
    });
  }

  const alternateDoctor = await prisma.doctorClinicAssignment.findFirst({
    where: {
      departmentId: window.departmentId,
      clinicId: window.clinicId,
      isActive: true,
      doctorId: { not: window.doctorId },
      doctor: {
        availabilityWindows: {
          some: {
            date: window.date,
            status: { in: [AvailabilityStatus.SCHEDULED, AvailabilityStatus.ACTIVE] },
          },
        },
      },
    },
  });

  if (alternateDoctor) {
    for (const ticket of affectedTickets) {
      await createQueueTicket({
        patientId: ticket.patientId,
        doctorId: alternateDoctor.doctorId,
        clinicId: ticket.clinicId,
        departmentId: ticket.departmentId,
        type: ticket.type,
        intakeFormId: ticket.intakeFormId ?? undefined,
      });
    }
  }
}

export async function handleDoctorDelayed(
  availabilityId: string,
  delayMinutes: number
): Promise<void> {
  const window = await prisma.availabilityWindow.findUnique({
    where: { id: availabilityId },
    include: { doctor: true },
  });

  if (!window) throw new Error("Availability window not found");

  const date = window.date;
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  await prisma.availabilityWindow.update({
    where: { id: availabilityId },
    data: { status: AvailabilityStatus.DELAYED, delayMinutes },
  });

  const waitingTickets = await prisma.queueTicket.findMany({
    where: {
      doctorId: window.doctorId,
      departmentId: window.departmentId,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: TicketStatus.WAITING,
    },
    include: { patient: true },
  });

  const avgDuration = await getAvgConsultDuration(window.doctorId);
  const newEstimates: { ticketId: string; estimatedWaitMinutes: number }[] = [];

  for (let i = 0; i < waitingTickets.length; i++) {
    const ticket = waitingTickets[i];
    const newEstimate = (i + 1) * avgDuration + delayMinutes;

    await prisma.queueTicket.update({
      where: { id: ticket.id },
      data: { estimatedWaitMinutes: newEstimate },
    });

    newEstimates.push({ ticketId: ticket.id, estimatedWaitMinutes: newEstimate });

    await notifyDoctorDelayed({
      patientId: ticket.patientId,
      phone: ticket.patient.phone,
      doctorName: `Dr. ${window.doctor.firstName} ${window.doctor.lastName}`,
      delayMinutes,
      newTime: `${newEstimate} mins`,
    });
  }

  await broadcastDoctorDelayed(
    window.clinicId,
    window.doctorId,
    delayMinutes,
    newEstimates
  );
}

export async function secureLoa(ticketId: string): Promise<EnrichedTicket> {
  const date = new Date();

  const ticket = await prisma.$transaction(async (tx) => {
    const existing = await tx.queueTicket.findUnique({
      where: { id: ticketId },
      include: { patient: true },
    });

    if (!existing) throw new Error("Ticket not found");
    if (existing.patient.category !== PatientCategory.HMO) {
      throw new Error("LOA only applies to HMO patients");
    }

    const newWeight = computePriorityWeight({
      createdAt: existing.createdAt,
      category: PatientCategory.HMO,
      type: existing.type,
      loaStatus: LOAStatus.SECURED,
    });

    return tx.queueTicket.update({
      where: { id: ticketId },
      data: {
        loaStatus: LOAStatus.SECURED,
        loaSecuredAt: new Date(),
        priorityWeight: newWeight,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            category: true,
            phone: true,
            languagePreference: true,
          },
        },
        intakeForm: {
          select: { chiefComplaint: true, languageFlag: true },
        },
        department: {
          select: {
            name: true,
            floor: true,
            building: true,
            navigationInstructions: true,
          },
        },
        doctor: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  });

  const enriched = await enrichSingleTicket(ticket, date);

  await broadcastLoaSecured(ticket.clinicId, ticket.id, ticket.patientId);

  const allTickets = await getActiveTickets(
    ticket.doctorId,
    ticket.departmentId,
    date
  );
  const enrichedAll = await enrichTicketsWithPosition(
    allTickets,
    ticket.doctorId,
    ticket.departmentId,
    date
  );

  await broadcastQueueUpdate(
    ticket.clinicId,
    ticket.doctorId,
    ticket.departmentId,
    enrichedAll
  );

  return enriched;
}

export async function getHmoPendingTickets(clinicId: string) {
  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());

  return prisma.queueTicket.findMany({
    where: {
      clinicId,
      loaStatus: LOAStatus.PENDING,
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          hmoProvider: true,
          phone: true,
        },
      },
      doctor: {
        select: { firstName: true, lastName: true },
      },
      department: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function recalculateQueue(
  doctorId: string,
  departmentId: string,
  clinicId: string
): Promise<EnrichedTicket[]> {
  const date = new Date();
  const tickets = await getActiveTickets(doctorId, departmentId, date);
  const enriched = await enrichTicketsWithPosition(
    tickets,
    doctorId,
    departmentId,
    date
  );

  for (const t of enriched) {
    await prisma.queueTicket.update({
      where: { id: t.id },
      data: { estimatedWaitMinutes: t.estimatedWaitMinutes },
    });
  }

  await broadcastQueueUpdate(clinicId, doctorId, departmentId, enriched);

  return enriched;
}
