"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input, Select, Button } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";

interface AvailabilityWindow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  delayMinutes: number;
  department: { name: string };
  clinic: { name: string };
}

export default function DoctorAvailabilityPage() {
  const { data: session } = useSession();
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [clinics, setClinics] = useState<Array<{ id: string; name: string; departments: Array<{ id: string; name: string }> }>>([]);
  const [form, setForm] = useState({
    clinicId: "",
    departmentId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "08:00",
    endTime: "17:00",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/doctors/availability").then((r) => r.json()),
      fetch("/api/clinics").then((r) => r.json()),
    ]).then(([avData, clinicData]) => {
      setWindows(avData.windows ?? []);
      setClinics(clinicData.clinics ?? []);
    });
  }, []);

  async function createWindow(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user.doctorId) return;
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/doctors/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId: session.user.doctorId,
        ...form,
      }),
    });

    if (res.ok) {
      setMessage("Availability window created");
      const avRes = await fetch("/api/doctors/availability");
      const avData = await avRes.json();
      setWindows(avData.windows ?? []);
    } else {
      setMessage("Failed to create availability");
    }
    setLoading(false);
  }

  async function updateStatus(id: string, status: string, delayMinutes?: number) {
    await fetch("/api/doctors/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, delayMinutes }),
    });
    const avRes = await fetch("/api/doctors/availability");
    const avData = await avRes.json();
    setWindows(avData.windows ?? []);
  }

  const selectedClinic = clinics.find((c) => c.id === form.clinicId);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Availability</h1>

      <Card title="Declare Availability" className="mb-8">
        <form onSubmit={createWindow} className="space-y-4">
          <Select
            label="Clinic"
            value={form.clinicId}
            onChange={(e) => setForm({ ...form, clinicId: e.target.value, departmentId: "" })}
            options={[
              { value: "", label: "Select clinic" },
              ...clinics.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {selectedClinic && (
            <Select
              label="Department"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              options={[
                { value: "", label: "Select department" },
                ...selectedClinic.departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}
          <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Time" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="End Time" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          {message && <p className="text-sm text-teal-700">{message}</p>}
          <Button type="submit" disabled={loading || !form.departmentId}>
            {loading ? "Creating..." : "Add Availability Window"}
          </Button>
        </form>
      </Card>

      <Card title="Your Schedule">
        <div className="space-y-3">
          {windows.map((w) => (
            <div key={w.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">
                  {new Date(w.date).toLocaleDateString()} · {w.startTime}–{w.endTime}
                </p>
                <p className="text-sm text-gray-500">
                  {w.clinic.name} — {w.department.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={w.status} />
                {w.status === "SCHEDULED" || w.status === "ACTIVE" ? (
                  <>
                    <Button variant="secondary" onClick={() => updateStatus(w.id, "DELAYED", 15)}>
                      Delay
                    </Button>
                    <Button variant="danger" onClick={() => updateStatus(w.id, "ABSENT")}>
                      Absent
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
          {windows.length === 0 && (
            <p className="text-gray-500 text-center py-4">No availability windows set</p>
          )}
        </div>
      </Card>
    </div>
  );
}
