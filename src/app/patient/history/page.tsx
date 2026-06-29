"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import {
  ConsultationRecordCard,
  type PatientConsultationRecord,
} from "@/components/consultation-record-card";

export default function PatientHistoryPage() {
  const [records, setRecords] = useState<PatientConsultationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patients/records")
      .then((r) => r.json())
      .then((data) => setRecords(data.records ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <LoadingState
        fullScreen
        title="Loading checkup history"
        message="Fetching your previous recommendations and prescriptions."
      />
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Checkup History</h1>

      <div className="space-y-4">
        {records.map((record) => (
          <ConsultationRecordCard key={record.id} record={record} />
        ))}
        {records.length === 0 && (
          <Card>
            <p className="py-8 text-center text-gray-500">No completed checkups yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
