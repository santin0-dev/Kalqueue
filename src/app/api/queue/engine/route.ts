import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recalculateQueue } from "@/lib/queue-engine";
import { z } from "zod";

const engineSchema = z.object({
  doctorId: z.string().min(1),
  departmentId: z.string().min(1),
  clinicId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "DOCTOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = engineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { doctorId, departmentId, clinicId } = parsed.data;
    const tickets = await recalculateQueue(doctorId, departmentId, clinicId);

    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("Queue engine error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
