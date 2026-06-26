"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Select, Button } from "@/components/ui/input";
import { CategoryBadge } from "@/components/ui/badge";

interface PatientProfile {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  category: string;
  languagePreference: string;
  hmoProvider: string | null;
  hmoMemberNumber: string | null;
  dateOfBirth: string;
  user: { email: string };
}

export default function PatientProfilePage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    languagePreference: "en",
    hmoProvider: "",
    hmoMemberNumber: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setForm({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          address: data.address,
          languagePreference: data.languagePreference,
          hmoProvider: data.hmoProvider ?? "",
          hmoMemberNumber: data.hmoMemberNumber ?? "",
        });
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/patients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setMessage("Profile updated successfully");
    } else {
      setMessage("Failed to update profile");
    }
    setSaving(false);
  }

  if (!profile) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <CategoryBadge category={profile.category} />
      </div>

      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <Input label="Email" value={profile.user.email} disabled />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Select
            label="Language Preference"
            value={form.languagePreference}
            onChange={(e) => setForm({ ...form, languagePreference: e.target.value })}
            options={[
              { value: "en", label: "English" },
              { value: "tl", label: "Tagalog" },
              { value: "ceb", label: "Cebuano" },
            ]}
          />
          {profile.category === "HMO" && (
            <>
              <Input label="HMO Provider" value={form.hmoProvider} onChange={(e) => setForm({ ...form, hmoProvider: e.target.value })} />
              <Input label="HMO Member Number" value={form.hmoMemberNumber} onChange={(e) => setForm({ ...form, hmoMemberNumber: e.target.value })} />
            </>
          )}
          {message && <p className="text-sm text-teal-700">{message}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
