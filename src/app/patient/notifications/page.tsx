"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  read: boolean;
}

export default function PatientNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function loadNotifications() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setNotifications(data.notifications ?? []);
  }

  useEffect(() => {
    loadNotifications().finally(() => setLoading(false));
  }, []);

  async function markRead(notificationId: string) {
    setPendingId(notificationId);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });

      if (res.ok) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId ? { ...item, read: true } : item
          )
        );
      }
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <LoadingState
        fullScreen
        title="Loading notifications"
        message="Checking your latest clinic updates."
      />
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Notifications</h1>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <Card key={notification.id} className={notification.read ? "" : "border-teal-100 bg-teal-50"}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-gray-900">{notification.title}</p>
                <p className="mt-1 text-sm text-gray-600">{notification.body}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(notification.sentAt).toLocaleString()}
                </p>
              </div>
              {!notification.read && (
                <Button
                  variant="secondary"
                  disabled={pendingId === notification.id}
                  onClick={() => markRead(notification.id)}
                >
                  {pendingId === notification.id ? "Saving..." : "Mark Read"}
                </Button>
              )}
            </div>
          </Card>
        ))}
        {notifications.length === 0 && (
          <Card>
            <p className="py-8 text-center text-gray-500">No notifications yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
