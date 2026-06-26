import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { announcementSchema, capacityConfigSchema } from "@/lib/validations";

export async function GET() {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { publishedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ announcements });
  } catch (err) {
    console.error("Announcements GET error:", err);
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
    const parsed = announcementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.create({
      data: {
        ...parsed.data,
        adminId: session.user.adminId!,
      },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (err) {
    console.error("Announcements POST error:", err);
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
    const { id, ...rest } = body as { id?: string; title?: string; body?: string; isActive?: boolean };

    if (!id) {
      return NextResponse.json({ error: "Announcement ID required" }, { status: 400 });
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: rest,
    });

    return NextResponse.json(announcement);
  } catch (err) {
    console.error("Announcements PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Announcement ID required" }, { status: 400 });
    }

    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Announcements DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
