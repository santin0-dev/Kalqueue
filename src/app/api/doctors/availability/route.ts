import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  availabilitySchema,
  updateAvailabilitySchema,
} from "@/lib/validations";
import {
  handleDoctorAbsent,
  handleDoctorDelayed,
  secureLoa,
  getHmoPendingTickets,
} from "@/lib/queue-engine";
import { loaSecureSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doctorId = req.nextUrl.searchParams.get("doctorId");
    const clinicId = req.nextUrl.searchParams.get("clinicId");
    const hmoLane = req.nextUrl.searchParams.get("hmoLane");

    if (hmoLane === "true" && clinicId) {
      const tickets = await getHmoPendingTickets(clinicId);
      return NextResponse.json({ tickets });
    }

    const windows = await prisma.availabilityWindow.findMany({
      where: {
        ...(doctorId ? { doctorId } : {}),
        ...(clinicId ? { clinicId } : {}),
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      include: {
        doctor: { select: { firstName: true, lastName: true, specialty: true } },
        department: { select: { name: true } },
        clinic: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ windows });
  } catch (err) {
    console.error("Availability GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "DOCTOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (body.action === "secureLoa") {
      const parsed = loaSecureSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      const ticket = await secureLoa(parsed.data.ticketId);
      return NextResponse.json(ticket);
    }

    const parsed = availabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const window = await prisma.availabilityWindow.create({
      data: {
        ...parsed.data,
        date: new Date(parsed.data.date),
      },
      include: {
        doctor: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    });

    return NextResponse.json(window, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "DOCTOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = body.id as string;

    if (!id) {
      return NextResponse.json({ error: "Availability ID required" }, { status: 400 });
    }

    const parsed = updateAvailabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status, delayMinutes } = parsed.data;

    if (status === "ABSENT") {
      await handleDoctorAbsent(id);
    } else if (status === "DELAYED") {
      await handleDoctorDelayed(id, delayMinutes ?? 0);
    } else {
      await prisma.availabilityWindow.update({
        where: { id },
        data: { status },
      });
    }

    const updated = await prisma.availabilityWindow.findUnique({
      where: { id },
      include: {
        doctor: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
