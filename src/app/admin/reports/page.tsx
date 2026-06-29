"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";

interface ReportSummary {
  totalTickets: number;
  completedTickets: number;
  noShowTickets: number;
  walkinCount: number;
  appointmentCount: number;
  avgWaitMinutes: number;
  completionRate: number;
}

export default function AdminReportsPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const clinicId = session?.user.clinicId ?? "";

  function download(path: string) {
    const url = clinicId ? `${path}?clinicId=${encodeURIComponent(clinicId)}` : path;
    window.location.href = url;
  }

  useEffect(() => {
    fetch(`/api/admin/reports?clinicId=${clinicId}`)
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clinicId]);

  if (loading) {
    return (
      <LoadingState
        fullScreen
        title="Generating reports"
        message="Collecting today's queue and consultation data."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Reports</h1>
          <p className="text-gray-500">Generate operational reports and backups.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => download("/api/admin/reports/download")}
          >
            Download Report CSV
          </Button>
          <Button onClick={() => download("/api/admin/backups")}>
            Download Backup
          </Button>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Tickets", value: summary.totalTickets },
              { label: "Completed", value: summary.completedTickets, color: "text-green-600" },
              { label: "No Shows", value: summary.noShowTickets, color: "text-red-500" },
              { label: "Avg Wait (min)", value: summary.avgWaitMinutes },
            ].map((item) => (
              <Card key={item.label}>
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className={`text-3xl font-bold ${item.color ?? "text-gray-900"}`}>
                  {item.value}
                </p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Visit Type Breakdown">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Walk-ins</span>
                    <span>{summary.walkinCount}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 bg-teal-600 rounded-full"
                      style={{
                        width: `${summary.totalTickets > 0 ? (summary.walkinCount / summary.totalTickets) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Appointments</span>
                    <span>{summary.appointmentCount}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className="h-2 bg-blue-600 rounded-full"
                      style={{
                        width: `${summary.totalTickets > 0 ? (summary.appointmentCount / summary.totalTickets) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Performance">
              <div className="text-center py-6">
                <div className="text-5xl font-bold text-teal-700 mb-2">
                  {summary.completionRate}%
                </div>
                <p className="text-gray-500">Completion Rate Today</p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
