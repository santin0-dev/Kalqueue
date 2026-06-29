"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { Button, Textarea, Input } from "@/components/ui/input";
import { QueueTicker } from "@/components/queue-ticker";
import { Modal } from "@/components/ui/modal";
import { LoadingState } from "@/components/ui/loading-state";
import { createPusherClient } from "@/lib/pusher";
import type PusherClient from "pusher-js";

interface QueueTicket {
  id: string;
  position: number;
  status: string;
  estimatedWaitMinutes: number;
  loaStatus: string;
  patient: {
    firstName: string;
    lastName: string;
    category: string;
  };
  intakeForm?: {
    chiefComplaint: string;
    languageFlag: string | null;
  } | null;
}

interface AvailabilityWindow {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  delayMinutes: number;
}

interface QueueStats {
  seen: number;
  avgTime: number;
  pending: number;
}

const LOCAL_AI_URL =
  process.env.NEXT_PUBLIC_LOCAL_AI_URL ?? "http://localhost:8765";
const MAX_RECORDING_MS = 30_000;

function formatAiFindings(data: {
  findings?: string;
  summary?: string;
  keyPoints?: string[];
}) {
  if (data.summary || data.keyPoints?.length) {
    return [
      data.summary ? `Summary:\n${data.summary}` : "",
      data.keyPoints?.length
        ? `Key points:\n${data.keyPoints.map((point) => `- ${point}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return data.findings ?? "";
}

export default function DoctorDashboard() {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [availability, setAvailability] = useState<AvailabilityWindow | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<QueueTicket | null>(null);
  const [consultForm, setConsultForm] = useState({ findings: "", prescription: "", followUpDate: "" });
  const [stats, setStats] = useState({ seen: 0, avgTime: 8, pending: 0 });
  const [clinicId, setClinicId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [setupLoading, setSetupLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState("");
  const [aiTranscript, setAiTranscript] = useState("");
  const [aiImprovedNote, setAiImprovedNote] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isCharting, setIsCharting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const aiWarmedRef = useRef(false);

  const applyQueueTickets = useCallback((nextTickets: QueueTicket[], nextStats?: QueueStats) => {
    setTickets(nextTickets);
    setStats((current) => nextStats ?? {
      ...current,
      pending: nextTickets.filter((t) => t.status === "WAITING").length,
    });
  }, []);

  const loadQueue = useCallback(async (nextDepartmentId = departmentId) => {
    if (!session?.user.doctorId || !nextDepartmentId) return;

    const qRes = await fetch(
      `/api/queue?doctorId=${session.user.doctorId}&departmentId=${nextDepartmentId}`
    );
    const qData = await qRes.json();
    applyQueueTickets(qData.tickets ?? [], qData.stats);
  }, [applyQueueTickets, departmentId, session?.user.doctorId]);

  const loadAvailability = useCallback(async () => {
    if (!session?.user.doctorId) return;

    const avRes = await fetch(
      `/api/doctors/availability?doctorId=${session.user.doctorId}`
    );
    const avData = await avRes.json();
    setAvailability(avData.windows?.[0] ?? null);
  }, [session?.user.doctorId]);

  const loadSetup = useCallback(async () => {
    if (!session?.user.doctorId) return;

    try {
      const doctorsRes = await fetch("/api/doctors");
      const doctorsData = await doctorsRes.json();
      const me = doctorsData.doctors?.find(
        (d: { id: string }) => d.id === session.user.doctorId
      );

      if (!me?.clinicAssignments?.[0]) return;

      const assignment = me.clinicAssignments[0];
      setClinicId(assignment.clinicId);
      setDepartmentId(assignment.departmentId);
      await Promise.all([
        loadQueue(assignment.departmentId),
        loadAvailability(),
      ]);
    } finally {
      setSetupLoading(false);
    }
  }, [loadAvailability, loadQueue, session?.user.doctorId]);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    if (!departmentId) return;

    const interval = window.setInterval(() => loadQueue(), 5000);
    return () => window.clearInterval(interval);
  }, [departmentId, loadQueue]);

  useEffect(() => {
    if (!clinicId || !session?.user.doctorId) return;

    const pusher = createPusherClient();
    if (!pusher) return;

    const channels = [
      pusher.subscribe(`clinic-${clinicId}`),
      pusher.subscribe(`doctor-${session.user.doctorId}`),
    ];

    channels.forEach((channel) => {
      channel.bind(
        "queue:updated",
        (data: { departmentId: string; tickets: QueueTicket[] }) => {
          if (data.departmentId === departmentId) {
            applyQueueTickets(data.tickets ?? []);
          }
        }
      );
    });

    return () => {
      channels.forEach((channel: ReturnType<PusherClient["subscribe"]>) => {
        channel.unbind_all();
        pusher.unsubscribe(channel.name);
      });
      pusher.disconnect();
    };
  }, [applyQueueTickets, clinicId, departmentId, session?.user.doctorId]);

  useEffect(() => {
    if (!selectedTicket || aiWarmedRef.current) return;

    aiWarmedRef.current = true;
    fetch(`${LOCAL_AI_URL}/warmup`, { method: "POST" }).catch(() => {
      aiWarmedRef.current = false;
    });
  }, [selectedTicket]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearTimeout(recordingTimerRef.current);
      }
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      stopMicMeter();
    };
  }, []);

  function resetAiDraft() {
    setAiStatus("");
    setAiTranscript("");
    setAiImprovedNote("");
    setMicLevel(0);
  }

  function formatFindingsForSave() {
    if (!aiTranscript && !aiImprovedNote) return consultForm.findings;

    return [
      aiTranscript ? `Original transcript:\n${aiTranscript}` : "",
      `Improved charting:\n${consultForm.findings}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  async function updateStatus(ticketId: string, status: string) {
    setPendingTicketId(ticketId);
    setActionError("");

    try {
      const res = await fetch(`/api/queue/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...consultForm,
          findings: status === "DONE" ? formatFindingsForSave() : consultForm.findings,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to update queue ticket");
      }

      if (status === "IN_CONSULT") {
        applyQueueTickets(
          tickets.map((ticket) =>
            ticket.id === ticketId ? { ...ticket, status: "IN_CONSULT" } : ticket
          )
        );
      }

      setSelectedTicket(null);
      if (status === "DONE") {
        setConsultForm({ findings: "", prescription: "", followUpDate: "" });
        resetAiDraft();
      }
      await loadQueue();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to update queue ticket");
    } finally {
      setPendingTicketId(null);
    }
  }

  async function updateAvailability(status: string, delayMinutes?: number) {
    if (!availability) return;
    await fetch("/api/doctors/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: availability.id, status, delayMinutes }),
    });
    loadAvailability();
    loadQueue();
  }

  async function generateAiChart(audioBlob: Blob) {
    setIsCharting(true);
    setAiStatus("Generating chart note...");

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "consultation.webm");
      formData.append(
        "context",
        selectedTicket
          ? JSON.stringify({
              patient: `${selectedTicket.patient.firstName} ${selectedTicket.patient.lastName}`,
              category: selectedTicket.patient.category,
              chiefComplaint: selectedTicket.intakeForm?.chiefComplaint ?? "",
            })
          : ""
      );

      const res = await fetch(`${LOCAL_AI_URL}/chart`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Local AI charting failed");
      }

      const improvedFindings = formatAiFindings(data ?? {});

      setAiTranscript(data.transcript ?? "");
      setAiImprovedNote(improvedFindings);
      setConsultForm((current) => ({
        ...current,
        findings: improvedFindings || current.findings,
        prescription: data.prescription || current.prescription,
        followUpDate: data.followUpDate || current.followUpDate,
      }));
      setAiStatus("Draft chart note ready.");
    } catch (err) {
      setAiStatus(
        err instanceof Error
          ? err.message
          : "Local AI service is unavailable."
      );
    } finally {
      setIsCharting(false);
    }
  }

  function stopMicMeter() {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
    setMicLevel(0);
  }

  function startMicMeter(stream: MediaStream) {
    stopMicMeter();

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const samples = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(samples);
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      setMicLevel(Math.min(100, Math.round((average / 160) * 100)));
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };
    tick();
  }

  async function startAiRecording() {
    if (isRecording || isCharting) return;

    try {
      setAiStatus("");
      setAiTranscript("");
      setAiImprovedNote("");
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startMicMeter(stream);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        stopMicMeter();
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          generateAiChart(blob);
        }
      };

      recorder.start();
      setIsRecording(true);
      setAiStatus("Recording...");
      recordingTimerRef.current = window.setTimeout(() => {
        stopAiRecording();
      }, MAX_RECORDING_MS);
    } catch {
      setAiStatus("Microphone permission is required.");
    }
  }

  function stopAiRecording() {
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
  }

  if (setupLoading) {
    return (
      <LoadingState
        fullScreen
        title="Loading doctor dashboard"
        message="Preparing queue, availability, and live updates."
      />
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dr. {session?.user.firstName}&apos;s Dashboard
          </h1>
          <p className="text-gray-500">Today&apos;s patient queue</p>
        </div>
        {availability && (
          <div className="flex items-center gap-2">
            <StatusBadge status={availability.status} />
            <Button variant="secondary" onClick={() => updateAvailability("DELAYED", 15)}>
              Mark Delayed (+15m)
            </Button>
            <Button variant="danger" onClick={() => updateAvailability("ABSENT")}>
              Mark Absent
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <p className="text-sm text-gray-500">Patients Seen</p>
          <p className="text-3xl font-bold text-gray-900">{stats.seen}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Avg Consult Time</p>
          <p className="text-3xl font-bold text-gray-900">{stats.avgTime} min</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Pending in Queue</p>
          <p className="text-3xl font-bold text-teal-700">{stats.pending}</p>
        </Card>
      </div>

      {clinicId && session?.user.doctorId && (
        <div className="mb-6">
          <QueueTicker
            clinicId={clinicId}
            doctorId={session.user.doctorId}
          />
        </div>
      )}

      <Card title="Live Queue">
        {actionError && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {actionError}
          </p>
        )}
        {tickets.length === 0 ? (
          <p className="text-gray-500">No patients in queue</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-teal-700 w-10">
                    #{ticket.position}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {ticket.patient.firstName} {ticket.patient.lastName}
                      </p>
                      <CategoryBadge category={ticket.patient.category} />
                    </div>
                    {ticket.intakeForm && (
                      <p className="text-sm text-gray-500">
                        {ticket.intakeForm.chiefComplaint}
                        {ticket.intakeForm.languageFlag && (
                          <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded">
                            {ticket.intakeForm.languageFlag}
                          </span>
                        )}
                      </p>
                    )}
                    {ticket.loaStatus !== "NOT_REQUIRED" && (
                      <p className="text-xs text-purple-600">LOA: {ticket.loaStatus}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={ticket.status} />
                  {ticket.status === "WAITING" && (
                    <Button
                      disabled={pendingTicketId === ticket.id}
                      onClick={() => updateStatus(ticket.id, "IN_CONSULT")}
                    >
                      {pendingTicketId === ticket.id ? "Calling..." : "Call In"}
                    </Button>
                  )}
                  {ticket.status === "IN_CONSULT" && (
                    <>
                      <Button
                        disabled={pendingTicketId === ticket.id}
                        onClick={() => {
                          resetAiDraft();
                          setSelectedTicket(ticket);
                        }}
                      >
                        Complete
                      </Button>
                      <Button
                        variant="danger"
                        disabled={pendingTicketId === ticket.id}
                        onClick={() => updateStatus(ticket.id, "NO_SHOW")}
                      >
                        No Show
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={!!selectedTicket}
        onClose={() => {
          if (isRecording) stopAiRecording();
          setSelectedTicket(null);
        }}
        title="Consultation Record"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={isRecording ? "danger" : "secondary"}
                disabled={isCharting}
                onClick={isRecording ? stopAiRecording : startAiRecording}
              >
                {isRecording
                  ? "Stop & Generate"
                  : isCharting
                    ? "Generating..."
                    : "Record AI Note"}
              </Button>
              {aiStatus && (
                <span className="text-sm text-teal-800">{aiStatus}</span>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-teal-700 transition-all"
                style={{ width: `${isRecording ? Math.max(micLevel, 4) : 0}%` }}
              />
            </div>
            {aiTranscript && (
              <Textarea
                label="Original Transcript"
                value={aiTranscript}
                onChange={(e) => setAiTranscript(e.target.value)}
                rows={3}
                className="mt-3 bg-white text-xs"
              />
            )}
          </div>
          <Textarea
            label={aiImprovedNote ? "Improved Charting" : "Findings"}
            value={consultForm.findings}
            onChange={(e) => setConsultForm({ ...consultForm, findings: e.target.value })}
          />
          <Textarea
            label="Prescription"
            value={consultForm.prescription}
            onChange={(e) => setConsultForm({ ...consultForm, prescription: e.target.value })}
          />
          <Input
            label="Follow-up Date"
            type="date"
            value={consultForm.followUpDate}
            onChange={(e) => setConsultForm({ ...consultForm, followUpDate: e.target.value })}
          />
          <Button
            className="w-full"
            onClick={() => selectedTicket && updateStatus(selectedTicket.id, "DONE")}
          >
            Mark Done & Save Record
          </Button>
        </div>
      </Modal>
    </div>
  );
}
