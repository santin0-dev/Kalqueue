import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTicketStatus } from "@/lib/queue-engine";
import { updateQueueTicketSchema } from "@/lib/validations";
import { broadcastQueueCalled } from "@/lib/pusher";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateQueueTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status, findings, prescription, followUpDate } = parsed.data;

    if (status === "IN_CONSULT") {
      const ticket = await prisma.queueTicket.update({
        where: { id: params.ticketId },
        data: {
          status: "IN_CONSULT",
          calledAt: new Date(),
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              category: true,
              phone: true,
              languagePreference: true,
            },
          },
          intakeForm: {
            select: { chiefComplaint: true, languageFlag: true },
          },
          department: {
            select: {
              name: true,
              floor: true,
              building: true,
              navigationInstructions: true,
            },
          },
          doctor: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      await broadcastQueueCalled(
        ticket.clinicId,
        ticket.doctorId,
        ticket.patientId,
        ticket.id
      );

      return NextResponse.json({ ...ticket, position: 1 });
    }

    const ticket = await updateTicketStatus(params.ticketId, status);

    if (status === "DONE" && (findings || prescription || followUpDate)) {
      await prisma.consultationRecord.update({
        where: { queueTicketId: params.ticketId },
        data: {
          findings,
          prescription,
          followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        },
      });
    }

    return NextResponse.json(ticket);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await prisma.queueTicket.findUnique({
      where: { id: params.ticketId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            category: true,
            phone: true,
            languagePreference: true,
          },
        },
        intakeForm: true,
        department: true,
        doctor: { select: { firstName: true, lastName: true } },
        clinic: { select: { name: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (err) {
    console.error("Ticket GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
