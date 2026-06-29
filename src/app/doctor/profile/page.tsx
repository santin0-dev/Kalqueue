"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button, Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";

interface DoctorProfile {
  firstName: string;
  lastName: string;
  specialty: string;
  licenseNumber: string;
  phone: string;
  signatureImage: string | null;
  user: { email: string };
}

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/doctors/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setSignatureImage(data.signatureImage ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please upload an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSignatureImage(String(reader.result));
      setMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function saveSignature() {
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/doctors/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureImage }),
    });

    setMessage(res.ok ? "Signature saved." : "Failed to save signature.");
    setSaving(false);
  }

  if (loading || !profile) {
    return (
      <LoadingState
        fullScreen
        title="Loading doctor profile"
        message="Preparing your signature settings."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Doctor Profile</h1>

      <Card title="Professional Details" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={`Dr. ${profile.firstName} ${profile.lastName}`} disabled />
          <Input label="Email" value={profile.user.email} disabled />
          <Input label="Specialty" value={profile.specialty} disabled />
          <Input label="License Number" value={profile.licenseNumber} disabled />
          <Input label="Phone" value={profile.phone} disabled />
        </div>
      </Card>

      <Card
        title="E-Signature"
        subtitle="This appears on patient prescription records when medicine is prescribed."
      >
        <div className="space-y-4">
          <Input
            label="Upload Signature Image"
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
            {signatureImage ? (
              <div
                aria-label="Doctor e-signature preview"
                role="img"
                className="h-24 w-full bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${signatureImage})` }}
              />
            ) : (
              <p className="text-sm text-gray-500">No signature uploaded</p>
            )}
          </div>

          {message && <p className="text-sm text-teal-700">{message}</p>}

          <div className="flex gap-2">
            <Button disabled={saving} onClick={saveSignature}>
              {saving ? "Saving..." : "Save Signature"}
            </Button>
            {signatureImage && (
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setSignatureImage(null)}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
