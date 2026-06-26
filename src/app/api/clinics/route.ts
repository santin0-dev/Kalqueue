import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { capacityConfigSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = req.nextUrl.searchParams.get("clinicId");

    if (clinicId) {
      const config = await prisma.clinicCapacityConfig.findUnique({
        where: { clinicId },
      });
      return NextResponse.json({ config });
    }

    const clinics = await prisma.clinic.findMany({
      include: {
        capacityConfig: true,
        departments: true,
        _count: { select: { doctorAssignments: true } },
      },
    });

    return NextResponse.json({ clinics });
  } catch (err) {
    console.error("Clinics GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = capacityConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { clinicId, ...configData } = parsed.data;

    const config = await prisma.clinicCapacityConfig.upsert({
      where: { clinicId },
      create: { clinicId, ...configData },
      update: configData,
    });

    return NextResponse.json(config);
  } catch (err) {
    console.error("Clinics PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
