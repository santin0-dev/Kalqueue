import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "PATIENT" || !session.user.patientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const records = await prisma.consultationRecord.findMany({
      where: { patientId: session.user.patientId },
      include: {
        doctor: {
          select: {
            firstName: true,
            lastName: true,
            specialty: true,
            licenseNumber: true,
            signatureImage: true,
          },
        },
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
    console.error("Patient records GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
