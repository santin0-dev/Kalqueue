"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";

interface ConsultationRecord {
  id: string;
  findings: string | null;
  prescription: string | null;
  followUpDate: string | null;
  createdAt: string;
  patient: { firstName: string; lastName: string };
  doctor: {
    firstName: string;
    lastName: string;
    specialty: string;
    licenseNumber: string;
    signatureImage: string | null;
  };
  queueTicket: {
    clinic: { name: string };
    department: { name: string };
  };
}

export default function AdminRecordsPage() {
  const [records, setRecords] = useState<ConsultationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/records")
      .then((r) => r.json())
      .then((data) => {
        setRecords(data.records ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <LoadingState
        fullScreen
        title="Loading consultation records"
        message="Fetching completed checkups and doctor notes."
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Consultation Records</h1>
      <div className="space-y-4">
        {records.map((record) => (
          <Card key={record.id}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">
                  {record.patient.firstName} {record.patient.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  Dr. {record.doctor.firstName} {record.doctor.lastName} · {record.doctor.specialty}
                </p>
                <p className="text-xs text-gray-400">
                  {record.queueTicket.clinic.name} — {record.queueTicket.department.name}
                </p>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(record.createdAt).toLocaleDateString()}
              </span>
            </div>
            {record.findings && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Findings</p>
                <p className="text-sm text-gray-700">{record.findings}</p>
              </div>
            )}
            {record.prescription && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Prescription</p>
                <p className="text-sm text-gray-700">{record.prescription}</p>
                {record.doctor.signatureImage && (
                  <div className="mt-3 inline-block rounded border border-gray-100 bg-gray-50 p-3">
                    <div
                      aria-label="Doctor e-signature"
                      role="img"
                      className="h-16 w-48 bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url(${record.doctor.signatureImage})` }}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Dr. {record.doctor.firstName} {record.doctor.lastName} - License {record.doctor.licenseNumber}
                    </p>
                  </div>
                )}
              </div>
            )}
            {record.followUpDate && (
              <p className="text-sm text-teal-700">
                Follow-up: {new Date(record.followUpDate).toLocaleDateString()}
              </p>
            )}
          </Card>
        ))}
        {records.length === 0 && (
          <Card>
            <p className="text-gray-500 text-center py-8">No consultation records yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
