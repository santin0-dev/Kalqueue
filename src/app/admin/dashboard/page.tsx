"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { Button, Input } from "@/components/ui/input";
import { QueueTicker } from "@/components/queue-ticker";

interface HmoTicket {
  id: string;
  loaStatus: string;
  patient: { firstName: string; lastName: string; hmoProvider: string | null; phone: string };
  doctor: { firstName: string; lastName: string };
  department: { name: string };
}

interface AvailabilityWindow {
  id: string;
  status: string;
  delayMinutes: number;
  doctor: { firstName: string; lastName: string; specialty: string };
  department: { name: string };
}

interface ReportSummary {
  totalTickets: number;
  completedTickets: number;
  pendingInQueue: number;
  avgWaitMinutes: number;
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [hmoTickets, setHmoTickets] = useState<HmoTicket[]>([]);
  const [availability, setAvailability] = useState<AvailabilityWindow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [capacity, setCapacity] = useState({
    appointmentRatio: 0.6,
    walkinRatio: 0.4,
    blockSize: 10,
    maxDailyWalkins: 50,
  });
  const [clinicId, setClinicId] = useState("");

  useEffect(() => {
    const cid = session?.user.clinicId;
    if (cid) setClinicId(cid);

    Promise.all([
      fetch(`/api/doctors/availability?hmoLane=true&clinicId=${cid ?? ""}`).then((r) => r.json()),
      fetch("/api/doctors/availability").then((r) => r.json()),
      fetch(`/api/admin/reports?clinicId=${cid ?? ""}`).then((r) => r.json()),
      fetch(`/api/clinics?clinicId=${cid ?? ""}`).then((r) => r.json()),
    ]).then(([hmoData, avData, reportData, clinicData]) => {
      setHmoTickets(hmoData.tickets ?? []);
      setAvailability(avData.windows ?? []);
      setSummary(reportData.summary ?? null);
      if (clinicData.config) {
        setCapacity({
          appointmentRatio: clinicData.config.appointmentRatio,
          walkinRatio: clinicData.config.walkinRatio,
          blockSize: clinicData.config.blockSize,
          maxDailyWalkins: clinicData.config.maxDailyWalkins,
        });
      }
    });
  }, [session?.user.clinicId]);

  async function secureLoa(ticketId: string) {
    await fetch("/api/doctors/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "secureLoa", ticketId }),
    });
    const hmoRes = await fetch(
      `/api/doctors/availability?hmoLane=true&clinicId=${clinicId}`
    );
    const hmoData = await hmoRes.json();
    setHmoTickets(hmoData.tickets ?? []);
  }

  async function saveCapacity() {
    await fetch("/api/clinics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, ...capacity }),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
      <p className="text-gray-500 mb-8">Clinic-wide operations overview</p>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <p className="text-sm text-gray-500">Total Today</p>
            <p className="text-2xl font-bold">{summary.totalTickets}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-green-600">{summary.completedTickets}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Avg Wait</p>
            <p className="text-2xl font-bold">{summary.avgWaitMinutes} min</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Completion Rate</p>
            <p className="text-2xl font-bold text-teal-700">
              {summary.totalTickets > 0
                ? Math.round((summary.completedTickets / summary.totalTickets) * 100)
                : 0}%
            </p>
          </Card>
        </div>
      )}

      {clinicId && <QueueTicker clinicId={clinicId} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Card title="HMO Fast Lane — Pending LOA">
          {hmoTickets.length === 0 ? (
            <p className="text-gray-500 text-sm">No pending LOA tickets</p>
          ) : (
            <div className="space-y-3">
              {hmoTickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <div>
                    <p className="font-medium">
                      {t.patient.firstName} {t.patient.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Dr. {t.doctor.firstName} {t.doctor.lastName} · {t.department.name}
                    </p>
                    {t.patient.hmoProvider && (
                      <p className="text-xs text-purple-600">{t.patient.hmoProvider}</p>
                    )}
                  </div>
                  <Button onClick={() => secureLoa(t.id)}>Mark LOA Secured</Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Doctor Availability Board">
          <div className="space-y-3">
            {availability.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">
                    Dr. {w.doctor.firstName} {w.doctor.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{w.department.name}</p>
                </div>
                <StatusBadge status={w.status} />
              </div>
            ))}
            {availability.length === 0 && (
              <p className="text-gray-500 text-sm">No doctors scheduled today</p>
            )}
          </div>
        </Card>

        <Card title="Capacity Configuration" className="lg:col-span-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Appointment Ratio"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={capacity.appointmentRatio}
              onChange={(e) => setCapacity({ ...capacity, appointmentRatio: parseFloat(e.target.value) })}
            />
            <Input
              label="Walk-in Ratio"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={capacity.walkinRatio}
              onChange={(e) => setCapacity({ ...capacity, walkinRatio: parseFloat(e.target.value) })}
            />
            <Input
              label="Block Size"
              type="number"
              value={capacity.blockSize}
              onChange={(e) => setCapacity({ ...capacity, blockSize: parseInt(e.target.value) })}
            />
            <Input
              label="Max Daily Walk-ins"
              type="number"
              value={capacity.maxDailyWalkins}
              onChange={(e) => setCapacity({ ...capacity, maxDailyWalkins: parseInt(e.target.value) })}
            />
          </div>
          <Button className="mt-4" onClick={saveCapacity}>Save Configuration</Button>
        </Card>
      </div>
    </div>
  );
}
