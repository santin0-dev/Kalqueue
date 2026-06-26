"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Select, Button } from "@/components/ui/input";
import { IntakeForm } from "@/components/intake-form";

interface Clinic {
  id: string;
  name: string;
  departments: Array<{ id: string; name: string }>;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  clinicAssignments: Array<{
    clinicId: string;
    departmentId: string;
    clinic: { id: string; name: string };
    department: { id: string; name: string };
  }>;
}

export default function BookPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<"intake" | "booking">("intake");
  const [intakeFormId, setIntakeFormId] = useState("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [visitType, setVisitType] = useState<"WALKIN" | "APPOINTMENT">("WALKIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/clinics").then((r) => r.json()),
      fetch("/api/doctors").then((r) => r.json()),
    ]).then(([clinicData, doctorData]) => {
      setClinics(clinicData.clinics ?? []);
      setDoctors(doctorData.doctors ?? []);
    });
  }, []);

  const selectedClinic = clinics.find((c) => c.id === clinicId);
  const filteredDoctors = doctors.filter((d) =>
    d.clinicAssignments.some(
      (a) => a.clinicId === clinicId && (!departmentId || a.departmentId === departmentId)
    )
  );

  async function joinQueue() {
    if (!session?.user.patientId || !doctorId || !clinicId || !departmentId) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: session.user.patientId,
          doctorId,
          clinicId,
          departmentId,
          type: visitType,
          intakeFormId: intakeFormId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to join queue");
        return;
      }

      router.push("/patient/queue");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (step === "intake" && session?.user.patientId) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Book a Visit</h1>
        <IntakeForm
          patientId={session.user.patientId}
          onComplete={(id) => {
            setIntakeFormId(id);
            setStep("booking");
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Select Clinic & Doctor</h1>
      <Card>
        <div className="space-y-4">
          <Select
            label="Clinic"
            value={clinicId}
            onChange={(e) => {
              setClinicId(e.target.value);
              setDepartmentId("");
              setDoctorId("");
            }}
            options={[
              { value: "", label: "Select a clinic" },
              ...clinics.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          {selectedClinic && (
            <Select
              label="Department"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setDoctorId("");
              }}
              options={[
                { value: "", label: "Select department" },
                ...selectedClinic.departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
          )}

          {departmentId && (
            <Select
              label="Doctor"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              options={[
                { value: "", label: "Select doctor" },
                ...filteredDoctors.map((d) => ({
                  value: d.id,
                  label: `Dr. ${d.firstName} ${d.lastName} — ${d.specialty}`,
                })),
              ]}
            />
          )}

          <Select
            label="Visit Type"
            value={visitType}
            onChange={(e) => setVisitType(e.target.value as "WALKIN" | "APPOINTMENT")}
            options={[
              { value: "WALKIN", label: "Walk-in" },
              { value: "APPOINTMENT", label: "Appointment" },
            ]}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            onClick={joinQueue}
            disabled={loading || !doctorId}
            className="w-full"
          >
            {loading ? "Joining queue..." : "Join Queue"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
