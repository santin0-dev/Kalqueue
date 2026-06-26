import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAppointmentSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { scheduledAt, ...rest } = parsed.data;

    const appointment = await prisma.appointment.update({
      where: { id: params.id },
      data: {
        ...rest,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } },
        clinic: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    return NextResponse.json(appointment);
  } catch (err) {
    console.error("Appointment PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        department: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (err) {
    console.error("Appointment GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
