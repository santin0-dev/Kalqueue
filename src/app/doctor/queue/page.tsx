"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/input";
import { QueueTicker } from "@/components/queue-ticker";
import { createPusherClient } from "@/lib/pusher";
import type PusherClient from "pusher-js";

interface QueueTicket {
  id: string;
  position: number;
  status: string;
  estimatedWaitMinutes: number;
  patient: {
    firstName: string;
    lastName: string;
    category: string;
  };
  intakeForm?: { chiefComplaint: string } | null;
}

export default function DoctorQueuePage() {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const loadQueue = useCallback(async (nextDepartmentId = departmentId) => {
    if (!session?.user.doctorId || !nextDepartmentId) return;

    const qRes = await fetch(
      `/api/queue?doctorId=${session.user.doctorId}&departmentId=${nextDepartmentId}`
    );
    const qData = await qRes.json();
    setTickets(qData.tickets ?? []);
  }, [departmentId, session?.user.doctorId]);

  const loadSetup = useCallback(async () => {
    if (!session?.user.doctorId) return;

    const doctorsRes = await fetch("/api/doctors");
    const doctorsData = await doctorsRes.json();
    const me = doctorsData.doctors?.find(
      (d: { id: string }) => d.id === session.user.doctorId
    );
    if (!me?.clinicAssignments?.[0]) return;

    const assignment = me.clinicAssignments[0];
    setClinicId(assignment.clinicId);
    setDepartmentId(assignment.departmentId);
    loadQueue(assignment.departmentId);
  }, [loadQueue, session?.user.doctorId]);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    if (!departmentId) return;

    const interval = window.setInterval(() => loadQueue(), 5000);
    return () => window.clearInterval(interval);
  }, [departmentId, loadQueue]);

  useEffect(() => {
    if (!clinicId || !session?.user.doctorId) return;

    const pusher = createPusherClient();
    if (!pusher) return;

    const channels = [
      pusher.subscribe(`clinic-${clinicId}`),
      pusher.subscribe(`doctor-${session.user.doctorId}`),
    ];

    channels.forEach((channel) => {
      channel.bind(
        "queue:updated",
        (data: { departmentId: string; tickets: QueueTicket[] }) => {
          if (data.departmentId === departmentId) {
            setTickets(data.tickets ?? []);
          }
        }
      );
    });

    return () => {
      channels.forEach((channel: ReturnType<PusherClient["subscribe"]>) => {
        channel.unbind_all();
        pusher.unsubscribe(channel.name);
      });
      pusher.disconnect();
    };
  }, [clinicId, departmentId, session?.user.doctorId]);

  async function updateStatus(ticketId: string, status: string) {
    setPendingTicketId(ticketId);
    setActionError("");

    try {
      const res = await fetch(`/api/queue/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to update queue ticket");
      }

      if (status === "IN_CONSULT") {
        setTickets((current) =>
          current.map((ticket) =>
            ticket.id === ticketId ? { ...ticket, status: "IN_CONSULT" } : ticket
          )
        );
      }

      await loadQueue();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update queue ticket");
    } finally {
      setPendingTicketId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Patient Queue</h1>

      {clinicId && session?.user.doctorId && (
        <div className="mb-6">
          <QueueTicker clinicId={clinicId} doctorId={session.user.doctorId} />
        </div>
      )}

      <Card>
        {actionError && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {actionError}
          </p>
        )}
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-center justify-between p-4 border border-gray-100 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-teal-700">#{ticket.position}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {ticket.patient.firstName} {ticket.patient.lastName}
                    </span>
                    <CategoryBadge category={ticket.patient.category} />
                  </div>
                  {ticket.intakeForm && (
                    <p className="text-sm text-gray-500">{ticket.intakeForm.chiefComplaint}</p>
                  )}
                  <p className="text-xs text-gray-400">Est. {ticket.estimatedWaitMinutes} min</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={ticket.status} />
                {ticket.status === "WAITING" && (
                  <Button
                    disabled={pendingTicketId === ticket.id}
                    onClick={() => updateStatus(ticket.id, "IN_CONSULT")}
                  >
                    {pendingTicketId === ticket.id ? "Calling..." : "Call"}
                  </Button>
                )}
                {ticket.status === "IN_CONSULT" && (
                  <Button
                    disabled={pendingTicketId === ticket.id}
                    onClick={() => updateStatus(ticket.id, "DONE")}
                  >
                    Done
                  </Button>
                )}
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <p className="text-gray-500 text-center py-8">Queue is empty</p>
          )}
        </div>
      </Card>
    </div>
  );
}
