import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPatientNotifications,
  markNotificationRead,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const patientId =
      session.user.role === "PATIENT"
        ? session.user.patientId
        : req.nextUrl.searchParams.get("patientId") ?? session.user.patientId;

    if (!patientId) {
      return NextResponse.json({ error: "Patient ID required" }, { status: 400 });
    }

    if (session.user.role === "PATIENT" && patientId !== session.user.patientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notifications = await getPatientNotifications(patientId);
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { notificationId } = body as { notificationId?: string };

    if (!notificationId) {
      return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
    }

    if (session.user.role === "PATIENT") {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { patientId: true },
      });

      if (!notification || notification.patientId !== session.user.patientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const notification = await markNotificationRead(notificationId);
    return NextResponse.json(notification);
  } catch (err) {
    console.error("Notifications PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
