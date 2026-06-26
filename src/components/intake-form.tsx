"use client";

import { useState } from "react";
import { Input, Textarea, Select, Button } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const COMPLAINT_OPTIONS = [
  { value: "general checkup", label: "General Checkup" },
  { value: "school medical", label: "School Medical Certificate" },
  { value: "travel visa", label: "Travel / Visa Medical" },
  { value: "HMO consult", label: "HMO Consultation" },
  { value: "government assisted", label: "Government Assisted (PhilHealth/Malasakit)" },
];

interface IntakeFormProps {
  patientId: string;
  onComplete: (intakeFormId: string, documentChecklist: string[]) => void;
}

export function IntakeForm({ patientId, onComplete }: IntakeFormProps) {
  const [chiefComplaint, setChiefComplaint] = useState("general checkup");
  const [notes, setNotes] = useState("");
  const [languagePreference, setLanguagePreference] = useState("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          chiefComplaint,
          notes,
          languagePreference,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Submission failed");
        return;
      }

      const docs = data.documentChecklist as string[];
      setChecklist(docs);
      onComplete(data.id, docs);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Patient Intake Form" subtitle="Tell us about your visit today">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Reason for Visit"
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          options={COMPLAINT_OPTIONS}
        />

        <Select
          label="Preferred Language"
          value={languagePreference}
          onChange={(e) => setLanguagePreference(e.target.value)}
          options={[
            { value: "en", label: "English" },
            { value: "tl", label: "Tagalog" },
            { value: "ceb", label: "Cebuano" },
            { value: "ilo", label: "Ilocano" },
          ]}
        />

        <Textarea
          label="Additional Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe your symptoms or concerns..."
        />

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Submitting..." : "Submit Intake Form"}
        </Button>
      </form>

      {checklist.length > 0 && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="font-medium text-amber-800 mb-2">Required Documents</h4>
          <ul className="space-y-1">
            {checklist.map((doc) => (
              <li key={doc} className="flex items-center gap-2 text-sm text-amber-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {doc}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
