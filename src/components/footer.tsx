import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="w-full px-6 lg:px-48 xl:px-60 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-8 h-8 text-teal-400" viewBox="0 0 32 32" fill="currentColor">
                <rect x="4" y="8" width="24" height="4" rx="2" />
                <rect x="4" y="14" width="18" height="4" rx="2" />
                <rect x="4" y="20" width="12" height="4" rx="2" />
              </svg>
              <span className="text-xl font-bold">KalQueue</span>
            </div>
            <p className="text-gray-400 text-sm max-w-md">
              Smart queue management for Philippine clinics and community hospitals.
              Reducing wait times, improving patient experience.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Get Started</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/register" className="hover:text-white transition-colors">Register</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Log In</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-sm text-gray-500 text-center">
          &copy; {new Date().getFullYear()} KalQueue. Built for Philippine healthcare.
        </div>
      </div>
    </footer>
  );
}
