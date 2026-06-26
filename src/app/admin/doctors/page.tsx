"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, Button } from "@/components/ui/input";

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  clinicAssignments: Array<{
    isActive: boolean;
    clinic: { id: string; name: string };
    department: { id: string; name: string };
  }>;
}

interface Clinic {
  id: string;
  name: string;
  departments: Array<{ id: string; name: string }>;
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [form, setForm] = useState({ doctorId: "", clinicId: "", departmentId: "" });
  const [message, setMessage] = useState("");

  function load() {
    Promise.all([
      fetch("/api/doctors").then((r) => r.json()),
      fetch("/api/clinics").then((r) => r.json()),
    ]).then(([doctorData, clinicData]) => {
      setDoctors(doctorData.doctors ?? []);
      setClinics(clinicData.clinics ?? []);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function assignDoctor(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setMessage("Doctor assigned successfully");
      load();
    } else {
      setMessage("Failed to assign doctor");
    }
  }

  const selectedClinic = clinics.find((c) => c.id === form.clinicId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Manage Doctors</h1>

      <Card title="Assign Doctor to Clinic" className="mb-8">
        <form onSubmit={assignDoctor} className="space-y-4">
          <Select
            label="Doctor"
            value={form.doctorId}
            onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
            options={[
              { value: "", label: "Select doctor" },
              ...doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${d.firstName} ${d.lastName} — ${d.specialty}`,
              })),
            ]}
          />
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
                ...selectedClinic.departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
          )}
          {message && <p className="text-sm text-teal-700">{message}</p>}
          <Button type="submit" disabled={!form.doctorId || !form.departmentId}>
            Assign Doctor
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        {doctors.map((doctor) => (
          <Card key={doctor.id}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Dr. {doctor.firstName} {doctor.lastName}
                </h3>
                <p className="text-sm text-gray-500">{doctor.specialty}</p>
              </div>
            </div>
            {doctor.clinicAssignments.length > 0 && (
              <div className="mt-3 space-y-2">
                {doctor.clinicAssignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`w-2 h-2 rounded-full ${a.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                    {a.clinic.name} — {a.department.name}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
