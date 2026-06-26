import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  availabilitySchema,
  updateAvailabilitySchema,
  doctorAssignmentSchema,
} from "@/lib/validations";
import {
  handleDoctorAbsent,
  handleDoctorDelayed,
} from "@/lib/queue-engine";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = req.nextUrl.searchParams.get("clinicId");
    const departmentId = req.nextUrl.searchParams.get("departmentId");

    const doctors = await prisma.doctor.findMany({
      where: {
        clinicAssignments: {
          some: {
            isActive: true,
            ...(clinicId ? { clinicId } : {}),
            ...(departmentId ? { departmentId } : {}),
          },
        },
      },
      include: {
        clinicAssignments: {
          where: { isActive: true },
          include: {
            clinic: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        availabilityWindows: {
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        },
      },
    });

    return NextResponse.json({ doctors });
  } catch (err) {
    console.error("Doctors GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = doctorAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const assignment = await prisma.doctorClinicAssignment.upsert({
      where: {
        doctorId_clinicId_departmentId: {
          doctorId: parsed.data.doctorId,
          clinicId: parsed.data.clinicId,
          departmentId: parsed.data.departmentId,
        },
      },
      create: parsed.data,
      update: { isActive: parsed.data.isActive ?? true },
      include: {
        doctor: { select: { firstName: true, lastName: true, specialty: true } },
        clinic: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    console.error("Doctors POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
