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
    const today = new Date();
    const dayStart = new Date(today.setHours(0, 0, 0, 0));
    const dayEnd = new Date(today.setHours(23, 59, 59, 999));

    const [
      totalTickets,
      completedTickets,
      noShowTickets,
      walkinCount,
      appointmentCount,
      avgWait,
    ] = await Promise.all([
      prisma.queueTicket.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.queueTicket.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          status: "DONE",
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.queueTicket.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          status: "NO_SHOW",
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.queueTicket.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          type: "WALKIN",
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.queueTicket.count({
        where: {
          ...(clinicId ? { clinicId } : {}),
          type: "APPOINTMENT",
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.queueTicket.aggregate({
        where: {
          ...(clinicId ? { clinicId } : {}),
          status: "DONE",
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        _avg: { estimatedWaitMinutes: true },
      }),
    ]);

    const departmentBreakdown = await prisma.queueTicket.groupBy({
      by: ["departmentId"],
      where: {
        ...(clinicId ? { clinicId } : {}),
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      _count: { id: true },
    });

    return NextResponse.json({
      summary: {
        totalTickets,
        completedTickets,
        noShowTickets,
        walkinCount,
        appointmentCount,
        avgWaitMinutes: Math.round(avgWait._avg.estimatedWaitMinutes ?? 0),
        completionRate:
          totalTickets > 0
            ? Math.round((completedTickets / totalTickets) * 100)
            : 0,
      },
      departmentBreakdown,
    });
  } catch (err) {
    console.error("Reports GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
