"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/features", label: "Features" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const dashboardHref =
    session?.user.role === "PATIENT"
      ? "/patient/dashboard"
      : session?.user.role === "DOCTOR"
        ? "/doctor/dashboard"
        : session?.user.role === "ADMIN"
          ? "/admin/dashboard"
          : null;

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 z-40">
      <div className="w-full px-6 lg:px-16 xl:px-24 h-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
            <Image src="/Global_logo.png" alt="KalQueue Logo" width={32} height={32} />
          <span className="text-xl font-bold text-gray-900">KalQueue</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "text-teal-700"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {session ? (
            <>
              {dashboardHref && (
                <Link
                  href={dashboardHref}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Dashboard
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-lg">
          <div className="px-6 py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`text-sm font-medium ${
                  pathname === link.href ? "text-teal-700" : "text-gray-500"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-gray-100" />
            {session ? (
              <>
                {dashboardHref && (
                  <Link href={dashboardHref} onClick={() => setMenuOpen(false)} className="text-sm font-medium text-teal-700">
                    Dashboard
                  </Link>
                )}
                <button onClick={() => signOut({ callbackUrl: "/" })} className="text-sm font-medium text-gray-500 text-left">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-500">
                  Log In
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-teal-700">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
