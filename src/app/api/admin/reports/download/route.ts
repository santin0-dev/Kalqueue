import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function dayRange(dateStr: string | null) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = req.nextUrl.searchParams.get("clinicId") ?? session.user.clinicId;
    const { dayStart, dayEnd } = dayRange(req.nextUrl.searchParams.get("date"));

    const tickets = await prisma.queueTicket.findMany({
      where: {
        ...(clinicId ? { clinicId } : {}),
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            category: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            firstName: true,
            lastName: true,
            specialty: true,
          },
        },
        clinic: { select: { name: true } },
        department: { select: { name: true } },
        consultationRecord: {
          select: {
            findings: true,
            prescription: true,
            followUpDate: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const header = [
      "Ticket ID",
      "Clinic",
      "Department",
      "Patient",
      "Patient Category",
      "Patient Phone",
      "Doctor",
      "Specialty",
      "Visit Type",
      "Status",
      "LOA Status",
      "Estimated Wait Minutes",
      "Created At",
      "Called At",
      "Completed At",
      "Findings",
      "Prescription",
      "Follow Up Date",
      "Record Created At",
    ];

    const rows = tickets.map((ticket) => [
      ticket.id,
      ticket.clinic.name,
      ticket.department.name,
      `${ticket.patient.firstName} ${ticket.patient.lastName}`,
      ticket.patient.category,
      ticket.patient.phone,
      `${ticket.doctor.firstName} ${ticket.doctor.lastName}`,
      ticket.doctor.specialty,
      ticket.type,
      ticket.status,
      ticket.loaStatus,
      ticket.estimatedWaitMinutes,
      ticket.createdAt,
      ticket.calledAt,
      ticket.completedAt,
      ticket.consultationRecord?.findings,
      ticket.consultationRecord?.prescription,
      ticket.consultationRecord?.followUpDate,
      ticket.consultationRecord?.createdAt,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const filename = `kalqueue-report-${dayStart.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Report download error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
