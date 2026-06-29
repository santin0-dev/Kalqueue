import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updatePatientSchema } from "@/lib/validations";
import { getQueuePosition } from "@/lib/queue-engine";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const patientId = req.nextUrl.searchParams.get("id") ?? session.user.patientId;

    if (!patientId) {
      return NextResponse.json({ error: "Patient ID required" }, { status: 400 });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: { select: { email: true } },
        appointments: {
          where: { status: { in: ["PENDING", "CONFIRMED"] } },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          include: {
            doctor: { select: { firstName: true, lastName: true } },
            clinic: { select: { name: true } },
          },
        },
        queueTickets: {
          where: { status: { in: ["WAITING", "IN_CONSULT"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            doctor: { select: { firstName: true, lastName: true } },
            department: true,
            intakeForm: true,
          },
        },
        intakeForms: {
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
        notifications: {
          orderBy: { sentAt: "desc" },
          take: 10,
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const queueTickets = await Promise.all(
      patient.queueTickets.map(async (ticket) => ({
        ...ticket,
        position: await getQueuePosition(
          ticket.id,
          ticket.doctorId,
          ticket.departmentId,
          ticket.createdAt
        ),
      }))
    );

    return NextResponse.json({ ...patient, queueTickets });
  } catch (err) {
    console.error("Patients GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updatePatientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const patientId = session.user.patientId;
    if (!patientId) {
      return NextResponse.json({ error: "Not a patient account" }, { status: 403 });
    }

    const patient = await prisma.patient.update({
      where: { id: patientId },
      data: parsed.data,
    });

    return NextResponse.json(patient);
  } catch (err) {
    console.error("Patients PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
