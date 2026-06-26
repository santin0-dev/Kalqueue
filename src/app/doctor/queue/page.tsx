"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/input";
import { QueueTicker } from "@/components/queue-ticker";

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

  const loadQueue = useCallback(async () => {
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

    const qRes = await fetch(
      `/api/queue?doctorId=${session.user.doctorId}&departmentId=${assignment.departmentId}`
    );
    const qData = await qRes.json();
    setTickets(qData.tickets ?? []);
  }, [session?.user.doctorId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  async function updateStatus(ticketId: string, status: string) {
    await fetch(`/api/queue/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadQueue();
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
                  <Button onClick={() => updateStatus(ticket.id, "IN_CONSULT")}>Call</Button>
                )}
                {ticket.status === "IN_CONSULT" && (
                  <Button onClick={() => updateStatus(ticket.id, "DONE")}>Done</Button>
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
