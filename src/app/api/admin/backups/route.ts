import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = req.nextUrl.searchParams.get("clinicId") ?? session.user.clinicId;
    const clinicWhere = clinicId ? { clinicId } : {};
    const patientWhere = clinicId
      ? {
          OR: [
            { queueTickets: { some: { clinicId } } },
            { appointments: { some: { clinicId } } },
            { consultations: { some: { queueTicket: { clinicId } } } },
          ],
        }
      : {};
    const doctorWhere = clinicId
      ? {
          clinicAssignments: { some: { clinicId } },
        }
      : {};
    const notificationWhere = clinicId
      ? {
          patient: {
            queueTickets: { some: { clinicId } },
          },
        }
      : {};

    const [
      clinics,
      departments,
      capacityConfigs,
      patients,
      doctors,
      admins,
      doctorAssignments,
      availabilityWindows,
      appointments,
      queueTickets,
      consultationRecords,
      notifications,
      announcements,
    ] = await Promise.all([
      prisma.clinic.findMany({
        where: clinicId ? { id: clinicId } : {},
      }),
      prisma.department.findMany({
        where: clinicWhere,
      }),
      prisma.clinicCapacityConfig.findMany({
        where: clinicWhere,
      }),
      prisma.patient.findMany({
        where: patientWhere,
        include: { user: { select: { email: true, role: true, createdAt: true } } },
      }),
      prisma.doctor.findMany({
        where: doctorWhere,
        include: { user: { select: { email: true, role: true, createdAt: true } } },
      }),
      prisma.admin.findMany({
        where: clinicId ? { clinicId } : {},
        include: { user: { select: { email: true, role: true, createdAt: true } } },
      }),
      prisma.doctorClinicAssignment.findMany({
        where: clinicWhere,
      }),
      prisma.availabilityWindow.findMany({
        where: clinicWhere,
      }),
      prisma.appointment.findMany({
        where: clinicWhere,
      }),
      prisma.queueTicket.findMany({
        where: clinicWhere,
      }),
      prisma.consultationRecord.findMany({
        where: {
          queueTicket: clinicId ? { clinicId } : {},
        },
      }),
      prisma.notification.findMany({
        where: notificationWhere,
      }),
      prisma.announcement.findMany({
        where: {
          admin: clinicId ? { clinicId } : {},
        },
      }),
    ]);

    const backup = {
      generatedAt: new Date().toISOString(),
      scope: clinicId ? { clinicId } : { clinicId: "all" },
      warning:
        "This backup excludes password hashes but contains patient and clinical data. Store it securely.",
      data: {
        clinics,
        departments,
        capacityConfigs,
        patients,
        doctors,
        admins,
        doctorAssignments,
        availabilityWindows,
        appointments,
        queueTickets,
        consultationRecords,
        notifications,
        announcements,
      },
    };

    const filename = `kalqueue-backup-${new Date().toISOString().slice(0, 10)}.json`;

    return NextResponse.json(backup, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Backup download error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
