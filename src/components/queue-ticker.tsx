"use client";

import { useEffect, useState, useCallback } from "react";
import { createPusherClient } from "@/lib/pusher";
import type PusherClient from "pusher-js";

interface QueueTicketData {
  id: string;
  position: number;
  estimatedWaitMinutes: number;
  status: string;
  patient?: {
    firstName: string;
    lastName: string;
    category: string;
  };
  doctor?: {
    firstName: string;
    lastName: string;
  };
  department?: {
    name: string;
    floor: string;
    building: string;
    navigationInstructions: string;
  };
}

interface QueueTickerProps {
  clinicId?: string;
  doctorId?: string;
  patientId?: string;
  ticketId?: string;
  initialTicket?: QueueTicketData | null;
  compact?: boolean;
}

export function QueueTicker({
  clinicId,
  doctorId,
  patientId,
  ticketId,
  initialTicket,
  compact = false,
}: QueueTickerProps) {
  const [ticket, setTicket] = useState<QueueTicketData | null>(initialTicket ?? null);
  const [tickets, setTickets] = useState<QueueTicketData[]>([]);
  const [connected, setConnected] = useState(false);

  const updateFromPayload = useCallback(
    (payload: { tickets?: QueueTicketData[]; ticketId?: string; patientId?: string }) => {
      if (payload.tickets) {
        setTickets(payload.tickets);
        if (ticketId) {
          const found = payload.tickets.find((t) => t.id === ticketId);
          if (found) setTicket(found);
        } else if (patientId) {
          const found = payload.tickets.find(
            (t) => t.patient && `${t.patient.firstName}` // match by patient in list
          );
          if (found) setTicket(found);
        }
      }
    },
    [ticketId, patientId]
  );

  useEffect(() => {
    const pusher = createPusherClient();
    if (!pusher) return;

    const channels: string[] = [];
    if (clinicId) channels.push(`clinic-${clinicId}`);
    if (doctorId) channels.push(`doctor-${doctorId}`);
    if (patientId) channels.push(`patient-${patientId}`);

    const subs: ReturnType<PusherClient["subscribe"]>[] = [];

    channels.forEach((channelName) => {
      const channel = pusher.subscribe(channelName);
      subs.push(channel);

      channel.bind("pusher:subscription_succeeded", () => setConnected(true));
      channel.bind("queue:updated", (data: { tickets: QueueTicketData[] }) => {
        updateFromPayload(data);
      });
      channel.bind("queue:called", (data: { ticketId: string }) => {
        if (data.ticketId === ticketId) {
          setTicket((prev) => (prev ? { ...prev, position: 1, status: "IN_CONSULT" } : prev));
        }
      });
      channel.bind("doctor:delayed", () => {
        /* positions recalculated via queue:updated */
      });
      channel.bind("loa:secured", (data: { ticketId: string }) => {
        if (data.ticketId === ticketId) {
          setTicket((prev) => (prev ? { ...prev, status: "WAITING" } : prev));
        }
      });
    });

    return () => {
      subs.forEach((ch) => {
        ch.unbind_all();
        pusher.unsubscribe(ch.name);
      });
      pusher.disconnect();
    };
  }, [clinicId, doctorId, patientId, ticketId, updateFromPayload]);

  if (compact && ticket) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-4xl font-bold text-teal-700">#{ticket.position}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">In Line</div>
        </div>
        <div>
          <p className="text-sm text-gray-500">Est. wait</p>
          <p className="text-lg font-semibold text-gray-900">{ticket.estimatedWaitMinutes} min</p>
        </div>
        {connected && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        )}
      </div>
    );
  }

  if (ticket) {
    return (
      <div className="bg-gradient-to-br from-teal-700 to-teal-800 rounded-xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-teal-200 text-sm font-medium mb-1">Your Queue Position</p>
            <div className="text-6xl font-bold">#{ticket.position}</div>
          </div>
          {connected && (
            <span className="flex items-center gap-1.5 text-xs bg-teal-600/50 px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live Updates
            </span>
          )}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-teal-200 text-sm">Estimated Wait</p>
            <p className="text-2xl font-semibold">{ticket.estimatedWaitMinutes} min</p>
          </div>
          <div>
            <p className="text-teal-200 text-sm">Status</p>
            <p className="text-2xl font-semibold">{ticket.status.replace("_", " ")}</p>
          </div>
        </div>
        {ticket.department && (
          <div className="mt-4 pt-4 border-t border-teal-600">
            <p className="text-teal-200 text-sm">Proceed to</p>
            <p className="font-medium">
              {ticket.department.name} — {ticket.department.floor} {ticket.department.building}
            </p>
            {ticket.department.navigationInstructions && (
              <p className="text-teal-200 text-sm mt-1">{ticket.department.navigationInstructions}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (tickets.length > 0) {
    return (
      <div className="space-y-3">
        {tickets.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-teal-700 w-10">#{t.position}</span>
              <div>
                {t.patient && (
                  <p className="font-medium text-gray-900">
                    {t.patient.firstName} {t.patient.lastName}
                  </p>
                )}
                <p className="text-sm text-gray-500">{t.status.replace("_", " ")}</p>
              </div>
            </div>
            <span className="text-sm text-gray-500">{t.estimatedWaitMinutes} min</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-center py-8 text-gray-500">
      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p>No active queue tickets</p>
    </div>
  );
}
