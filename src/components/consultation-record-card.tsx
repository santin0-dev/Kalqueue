import { Card } from "@/components/ui/card";

export interface PatientConsultationRecord {
  id: string;
  findings: string | null;
  prescription: string | null;
  followUpDate: string | null;
  createdAt: string;
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

export function ConsultationRecordCard({
  record,
  compact = false,
}: {
  record: PatientConsultationRecord;
  compact?: boolean;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-900">
            Dr. {record.doctor.firstName} {record.doctor.lastName}
          </p>
          <p className="text-sm text-gray-500">{record.doctor.specialty}</p>
          {!compact && (
            <p className="text-xs text-gray-400">
              {record.queueTicket.clinic.name} - {record.queueTicket.department.name}
            </p>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {new Date(record.createdAt).toLocaleDateString()}
        </span>
      </div>

      {record.findings && (
        <div className="mb-3">
          <p className="text-xs font-medium uppercase text-gray-500">Recommendations</p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{record.findings}</p>
        </div>
      )}

      {record.prescription && (
        <div className="mb-3">
          <p className="text-xs font-medium uppercase text-gray-500">Prescription</p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{record.prescription}</p>
          {record.doctor.signatureImage && (
            <div className="mt-4 inline-block rounded border border-gray-100 bg-gray-50 p-3">
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
        <p className="text-sm font-medium text-teal-700">
          Follow-up: {new Date(record.followUpDate).toLocaleDateString()}
        </p>
      )}
    </Card>
  );
}
