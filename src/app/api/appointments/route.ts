import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAppointmentSchema } from "@/lib/validations";
import { notifyBookingConfirmed } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const patientId = req.nextUrl.searchParams.get("patientId");
    const doctorId = req.nextUrl.searchParams.get("doctorId");

    const where: Record<string, string> = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;

    if (session.user.role === "PATIENT" && session.user.patientId) {
      where.patientId = session.user.patientId;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true, specialty: true } },
        clinic: { select: { name: true, address: true } },
        department: { select: { name: true, floor: true, building: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error("Appointments GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        ...parsed.data,
        scheduledAt: new Date(parsed.data.scheduledAt),
        status: "CONFIRMED",
      },
      include: {
        patient: true,
        clinic: true,
      },
    });

    await notifyBookingConfirmed({
      patientId: appointment.patientId,
      phone: appointment.patient.phone,
      clinicName: appointment.clinic.name,
      date: appointment.scheduledAt.toLocaleDateString(),
      documentChecklist: ["valid ID"],
      ticketId: appointment.id,
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (err) {
    console.error("Appointments POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
