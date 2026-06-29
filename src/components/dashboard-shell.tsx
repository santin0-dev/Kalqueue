"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { LoadingState } from "@/components/ui/loading-state";

const patientLinks = [
  { href: "/patient/dashboard", label: "Dashboard" },
  { href: "/patient/book", label: "Book Visit" },
  { href: "/patient/queue", label: "My Queue" },
  { href: "/patient/notifications", label: "Notifications" },
  { href: "/patient/history", label: "History" },
  { href: "/patient/profile", label: "Profile" },
];

const doctorLinks = [
  { href: "/doctor/dashboard", label: "Dashboard" },
  { href: "/doctor/queue", label: "Queue" },
  { href: "/doctor/availability", label: "Availability" },
  { href: "/doctor/profile", label: "Profile" },
];

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/records", label: "Records" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/doctors", label: "Doctors" },
];

export function DashboardShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "PATIENT" | "DOCTOR" | "ADMIN";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [navLoading, setNavLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setNavLoading(false);
    setMenuOpen(false);
  }, [pathname]);

  const links =
    role === "PATIENT"
      ? patientLinks
      : role === "DOCTOR"
        ? doctorLinks
        : adminLinks;

  const roleLabel =
    role === "PATIENT" ? "Patient" : role === "DOCTOR" ? "Doctor" : "Admin";

  return (
    <div className="min-h-screen bg-gray-50">
      {navLoading && (
        <LoadingState
          fullScreen
          title="Loading"
          message="Opening the selected page..."
        />
      )}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-16 xl:px-24 h-full flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
                <Image src="/Global_logo.png" alt="KalQueue Logo" width={32} height={32} />
              <span className="font-bold text-gray-900 hidden sm:inline">KalQueue</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => {
                    if (pathname !== link.href) setNavLoading(true);
                  }}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    pathname === link.href
                      ? "bg-teal-50 text-teal-700"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">
              {session?.user.firstName} · {roleLabel}
            </span>
            <button
              onClick={async () => {
                setNavLoading(true);
                await signOut({ redirect: false });
                router.push("/");
                router.refresh();
              }}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Sign Out
            </button>
            <button
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-50 md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle dashboard menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="absolute left-0 right-0 top-16 border-b border-gray-100 bg-white shadow-lg md:hidden">
            <div className="grid grid-cols-2 gap-2 px-4 py-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => {
                    if (pathname !== link.href) setNavLoading(true);
                  }}
                  className={`rounded-lg px-3 py-3 text-sm font-medium ${
                    pathname === link.href
                      ? "bg-teal-50 text-teal-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="pt-16">
        <div className="w-full px-4 sm:px-6 lg:px-16 xl:px-24 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
