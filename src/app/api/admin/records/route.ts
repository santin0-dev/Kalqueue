import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consultationRecordSchema } from "@/lib/validations";

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

    const records = await prisma.consultationRecord.findMany({
      where,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true, specialty: true } },
        queueTicket: {
          select: {
            clinic: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ records });
  } catch (err) {
    console.error("Records GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "DOCTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = consultationRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { queueTicketId, findings, prescription, followUpDate } = parsed.data;

    const record = await prisma.consultationRecord.update({
      where: { queueTicketId },
      data: {
        findings,
        prescription,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      },
    });

    return NextResponse.json(record);
  } catch (err) {
    console.error("Records PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
