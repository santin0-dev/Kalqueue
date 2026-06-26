"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { QueueTicker } from "@/components/queue-ticker";
import { StatusBadge } from "@/components/ui/badge";

interface TicketData {
  id: string;
  status: string;
  estimatedWaitMinutes: number;
  clinicId: string;
  doctorId: string;
  departmentId: string;
  loaStatus: string;
  doctor: { firstName: string; lastName: string };
  department: {
    name: string;
    floor: string;
    building: string;
    navigationInstructions: string;
  };
}

export default function PatientQueuePage() {
  const { data: session } = useSession();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then(async (patient) => {
        const active = patient.queueTickets?.[0];
        if (active) {
          setTicket(active);
          const qRes = await fetch(
            `/api/queue?doctorId=${active.doctorId}&departmentId=${active.departmentId}`
          );
          const qData = await qRes.json();
          const found = qData.tickets?.find(
            (t: { id: string; position: number }) => t.id === active.id
          );
          if (found) setPosition(found.position);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading...</div>;

  if (!ticket) {
    return (
      <Card title="No Active Queue Ticket">
        <p className="text-gray-500 mb-4">You are not currently in a queue.</p>
        <Link href="/patient/book" className="text-teal-700 font-medium hover:text-teal-800">
          Book a visit →
        </Link>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Live Queue Tracker</h1>

      <QueueTicker
        clinicId={ticket.clinicId}
        patientId={session?.user.patientId ?? undefined}
        ticketId={ticket.id}
        initialTicket={{
          id: ticket.id,
          position,
          estimatedWaitMinutes: ticket.estimatedWaitMinutes,
          status: ticket.status,
          doctor: ticket.doctor,
          department: ticket.department,
        }}
      />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Doctor</p>
          <p className="font-semibold text-gray-900">
            Dr. {ticket.doctor.firstName} {ticket.doctor.lastName}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Status</p>
          <StatusBadge status={ticket.status} />
        </Card>
        {ticket.loaStatus !== "NOT_REQUIRED" && (
          <Card className="sm:col-span-2">
            <p className="text-sm text-gray-500">HMO LOA Status</p>
            <p className="font-semibold text-purple-700">{ticket.loaStatus}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
