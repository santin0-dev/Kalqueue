import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createQueueTicket,
  getActiveTickets,
  enrichTicketsWithPosition,
} from "@/lib/queue-engine";
import {
  createQueueTicketSchema,
  queueQuerySchema,
} from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = queueQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { doctorId, departmentId, date: dateStr } = parsed.data;
    const date = dateStr ? new Date(dateStr) : new Date();

    const tickets = await getActiveTickets(doctorId, departmentId, date);
    const enriched = await enrichTicketsWithPosition(
      tickets,
      doctorId,
      departmentId,
      date
    );

    return NextResponse.json({ tickets: enriched });
  } catch (err) {
    console.error("Queue GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createQueueTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { ticket } = await createQueueTicket(parsed.data);

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("waitlist") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
