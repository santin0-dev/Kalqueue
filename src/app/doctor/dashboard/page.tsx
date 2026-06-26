"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { Button, Textarea, Input } from "@/components/ui/input";
import { QueueTicker } from "@/components/queue-ticker";
import { Modal } from "@/components/ui/modal";

interface QueueTicket {
  id: string;
  position: number;
  status: string;
  estimatedWaitMinutes: number;
  loaStatus: string;
  patient: {
    firstName: string;
    lastName: string;
    category: string;
  };
  intakeForm?: {
    chiefComplaint: string;
    languageFlag: string | null;
  } | null;
}

interface AvailabilityWindow {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  delayMinutes: number;
}

export default function DoctorDashboard() {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [availability, setAvailability] = useState<AvailabilityWindow | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<QueueTicket | null>(null);
  const [consultForm, setConsultForm] = useState({ findings: "", prescription: "", followUpDate: "" });
  const [stats, setStats] = useState({ seen: 0, avgTime: 8, pending: 0 });
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
    setStats({
      seen: qData.tickets?.filter((t: QueueTicket) => t.status === "DONE").length ?? 0,
      avgTime: 8,
      pending: qData.tickets?.filter((t: QueueTicket) => t.status === "WAITING").length ?? 0,
    });

    const avRes = await fetch(
      `/api/doctors/availability?doctorId=${session.user.doctorId}`
    );
    const avData = await avRes.json();
    setAvailability(avData.windows?.[0] ?? null);
  }, [session?.user.doctorId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  async function updateStatus(ticketId: string, status: string) {
    await fetch(`/api/queue/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        ...consultForm,
      }),
    });
    setSelectedTicket(null);
    loadQueue();
  }

  async function updateAvailability(status: string, delayMinutes?: number) {
    if (!availability) return;
    await fetch("/api/doctors/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: availability.id, status, delayMinutes }),
    });
    loadQueue();
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dr. {session?.user.firstName}&apos;s Dashboard
          </h1>
          <p className="text-gray-500">Today&apos;s patient queue</p>
        </div>
        {availability && (
          <div className="flex items-center gap-2">
            <StatusBadge status={availability.status} />
            <Button variant="secondary" onClick={() => updateAvailability("DELAYED", 15)}>
              Mark Delayed (+15m)
            </Button>
            <Button variant="danger" onClick={() => updateAvailability("ABSENT")}>
              Mark Absent
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <p className="text-sm text-gray-500">Patients Seen</p>
          <p className="text-3xl font-bold text-gray-900">{stats.seen}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Avg Consult Time</p>
          <p className="text-3xl font-bold text-gray-900">{stats.avgTime} min</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Pending in Queue</p>
          <p className="text-3xl font-bold text-teal-700">{stats.pending}</p>
        </Card>
      </div>

      {clinicId && session?.user.doctorId && (
        <div className="mb-6">
          <QueueTicker
            clinicId={clinicId}
            doctorId={session.user.doctorId}
          />
        </div>
      )}

      <Card title="Live Queue">
        {tickets.length === 0 ? (
          <p className="text-gray-500">No patients in queue</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-teal-700 w-10">
                    #{ticket.position}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {ticket.patient.firstName} {ticket.patient.lastName}
                      </p>
                      <CategoryBadge category={ticket.patient.category} />
                    </div>
                    {ticket.intakeForm && (
                      <p className="text-sm text-gray-500">
                        {ticket.intakeForm.chiefComplaint}
                        {ticket.intakeForm.languageFlag && (
                          <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded">
                            {ticket.intakeForm.languageFlag}
                          </span>
                        )}
                      </p>
                    )}
                    {ticket.loaStatus !== "NOT_REQUIRED" && (
                      <p className="text-xs text-purple-600">LOA: {ticket.loaStatus}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={ticket.status} />
                  {ticket.status === "WAITING" && (
                    <Button onClick={() => updateStatus(ticket.id, "IN_CONSULT")}>
                      Call In
                    </Button>
                  )}
                  {ticket.status === "IN_CONSULT" && (
                    <>
                      <Button onClick={() => setSelectedTicket(ticket)}>Complete</Button>
                      <Button variant="danger" onClick={() => updateStatus(ticket.id, "NO_SHOW")}>
                        No Show
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title="Consultation Record"
      >
        <div className="space-y-4">
          <Textarea
            label="Findings"
            value={consultForm.findings}
            onChange={(e) => setConsultForm({ ...consultForm, findings: e.target.value })}
          />
          <Textarea
            label="Prescription"
            value={consultForm.prescription}
            onChange={(e) => setConsultForm({ ...consultForm, prescription: e.target.value })}
          />
          <Input
            label="Follow-up Date"
            type="date"
            value={consultForm.followUpDate}
            onChange={(e) => setConsultForm({ ...consultForm, followUpDate: e.target.value })}
          />
          <Button
            className="w-full"
            onClick={() => selectedTicket && updateStatus(selectedTicket.id, "DONE")}
          >
            Mark Done & Save Record
          </Button>
        </div>
      </Modal>
    </div>
  );
}
