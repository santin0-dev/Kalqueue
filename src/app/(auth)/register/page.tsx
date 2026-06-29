"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input, Select, Button } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { LoadingState } from "@/components/ui/loading-state";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "PATIENT",
    firstName: "",
    lastName: "",
    inviteCode: "",
    dateOfBirth: "",
    phone: "",
    address: "",
    category: "REGULAR",
    specialty: "",
    licenseNumber: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function formatError(data: { error?: unknown; formErrors?: unknown }) {
    if (typeof data.error === "string") return data.error;

    if (Array.isArray(data.formErrors) && data.formErrors.length > 0) {
      return data.formErrors.join(" ");
    }

    if (data.error && typeof data.error === "object") {
      const messages = Object.values(data.error)
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .filter((value): value is string => typeof value === "string");

      if (messages.length > 0) return messages.join(" ");
    }

    return "Registration failed";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(formatError(data));
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created, but sign in failed. Please sign in manually.");
        setLoading(false);
        return;
      }

      const dashboard =
        form.role === "DOCTOR"
          ? "/doctor/dashboard"
          : form.role === "ADMIN"
            ? "/admin/dashboard"
            : "/patient/dashboard";

      router.push(dashboard);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      {loading && (
        <LoadingState
          fullScreen
          title="Creating account"
          message="Setting up your dashboard..."
        />
      )}
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <Image src="/Global_logo.png" alt="KalQueue Logo" width={32} height={32} />
            <span className="text-xl font-bold text-gray-900">KalQueue</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Account Type"
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              options={[
                { value: "PATIENT", label: "Patient" },
                { value: "DOCTOR", label: "Doctor" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required />
              <Input label="Last Name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required />
            </div>

            <Input label="Email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            <Input label="Password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
            <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} required />

            {form.role === "PATIENT" && (
              <>
                <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} required />
                <Input label="Phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
                <Input label="Address" value={form.address} onChange={(e) => update("address", e.target.value)} required />
                <Select
                  label="Patient Category"
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  options={[
                    { value: "REGULAR", label: "Regular" },
                    { value: "SENIOR", label: "Senior Citizen" },
                    { value: "PWD", label: "PWD" },
                    { value: "PREGNANT", label: "Pregnant" },
                    { value: "HMO", label: "HMO" },
                    { value: "GOVERNMENT_ASSISTED", label: "Government Assisted" },
                  ]}
                />
              </>
            )}

            {form.role === "DOCTOR" && (
              <>
                <Input label="Specialty" value={form.specialty} onChange={(e) => update("specialty", e.target.value)} required />
                <Input label="License Number" value={form.licenseNumber} onChange={(e) => update("licenseNumber", e.target.value)} required />
                <Input label="Phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
                <Input label="Doctor Invite Code" value={form.inviteCode} onChange={(e) => update("inviteCode", e.target.value)} required />
              </>
            )}

            {form.role === "ADMIN" && (
              <Input label="Admin Invite Code" value={form.inviteCode} onChange={(e) => update("inviteCode", e.target.value)} required />
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-teal-700 hover:text-teal-800 font-medium">
              Sign In
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
