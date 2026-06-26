"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Textarea, Button } from "@/components/ui/input";

interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  isActive: boolean;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState({ title: "", body: "" });
  const [loading, setLoading] = useState(false);

  function load() {
    fetch("/api/announcements")
      .then((r) => r.json())
      .then((data) => setAnnouncements(data.announcements ?? []));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ title: "", body: "" });
    load();
    setLoading(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch("/api/announcements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Announcements</h1>

      <Card title="Create Announcement" className="mb-8">
        <form onSubmit={create} className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Textarea
            label="Body"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Publishing..." : "Publish Announcement"}
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        {announcements.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <p className="text-gray-500 text-sm mt-1">{a.body}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(a.publishedAt).toLocaleDateString()}
                  {!a.isActive && " · Inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => toggleActive(a.id, a.isActive)}>
                  {a.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="danger" onClick={() => remove(a.id)}>Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
