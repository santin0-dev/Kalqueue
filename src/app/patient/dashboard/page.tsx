"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { QueueTicker } from "@/components/queue-ticker";

interface PatientData {
  firstName: string;
  lastName: string;
  category: string;
  queueTickets: Array<{
    id: string;
    status: string;
    loaStatus: string;
    estimatedWaitMinutes: number;
    clinicId: string;
    doctor: { firstName: string; lastName: string };
    department: {
      name: string;
      floor: string;
      building: string;
      navigationInstructions: string;
    };
  }>;
  appointments: Array<{
    id: string;
    scheduledAt: string;
    status: string;
    doctor: { firstName: string; lastName: string };
    clinic: { name: string };
  }>;
  intakeForms: Array<{
    documentChecklist: string[];
    chiefComplaint: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    sentAt: string;
    read: boolean;
  }>;
}

export default function PatientDashboard() {
  const { data: session } = useSession();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((data) => {
        setPatient(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-500">Loading dashboard...</div>;
  }

  const activeTicket = patient?.queueTickets[0];
  const lastIntake = patient?.intakeForms[0];
  const checklist = (lastIntake?.documentChecklist as string[]) ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {session?.user.firstName ?? patient?.firstName}
        </h1>
        <p className="text-gray-500">Your clinic visit dashboard</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTicket ? (
            <div>
              <QueueTicker
                clinicId={activeTicket.clinicId}
                patientId={session?.user.patientId ?? undefined}
                ticketId={activeTicket.id}
                initialTicket={{
                  id: activeTicket.id,
                  position: 0,
                  estimatedWaitMinutes: activeTicket.estimatedWaitMinutes,
                  status: activeTicket.status,
                  doctor: activeTicket.doctor,
                  department: activeTicket.department,
                }}
              />
              <div className="mt-4 flex items-center gap-3">
                <p className="text-sm text-gray-500">
                  Dr. {activeTicket.doctor.firstName} {activeTicket.doctor.lastName}
                </p>
                <StatusBadge status={activeTicket.status} />
              </div>
            </div>
          ) : (
            <Card title="No Active Queue">
              <p className="text-gray-500 mb-4">You&apos;re not in a queue right now.</p>
              <Link
                href="/patient/book"
                className="inline-block px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-sm font-medium"
              >
                Book a Visit
              </Link>
            </Card>
          )}

          <Card title="Upcoming Appointments">
            {patient?.appointments.length ? (
              <div className="space-y-3">
                {patient.appointments.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{apt.clinic.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(apt.scheduledAt).toLocaleDateString()}
                      </p>
                      <StatusBadge status={apt.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No upcoming appointments</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {patient?.category === "HMO" && activeTicket && (
            <Card title="HMO Status">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">LOA Status</span>
                <CategoryBadge category="HMO" />
              </div>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {activeTicket.loaStatus.replace("_", " ")}
              </p>
              {activeTicket.loaStatus === "PENDING" && (
                <p className="text-sm text-amber-600 mt-2">
                  Proceed to the HMO counter to secure your Letter of Authorization.
                </p>
              )}
            </Card>
          )}

          {checklist.length > 0 && (
            <Card title="Document Checklist">
              <ul className="space-y-2">
                {checklist.map((doc) => (
                  <li key={doc} className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {doc}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Recent Notifications">
            {patient?.notifications.length ? (
              <div className="space-y-3">
                {patient.notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className={`p-3 rounded-lg ${n.read ? "bg-gray-50" : "bg-teal-50"}`}>
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{n.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No notifications yet</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
