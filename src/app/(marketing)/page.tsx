import Link from "next/link";
import Image from "next/image";
const Home_img1 = "/Home_img1.png";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white w-full px-6 lg:px-48 xl:px-60 py-20 lg:py-32">
        {/* Changed max-w-4xl wrapper to match the side-by-side layout layout structure */}
        <div className="w-full grid md:grid-cols-2 gap-12 items-center">
          
          {/* Left — content block */}
          <div>
            <span className="inline-block px-3 py-1 bg-teal-50 text-teal-700 text-sm font-medium rounded-full mb-6">
              Built for Philippine Healthcare
            </span>
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Smarter queues for clinics that serve communities
            </h1>
            <p className="text-lg text-gray-500 mb-8 max-w-2xl">
              KalQueue helps Philippine clinics and community hospitals manage patient flow,
              reduce wait times, and keep everyone informed, from walk-ins to HMO patients.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-lg text-center transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                href="/features"
                className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-center transition-colors"
              >
                See Features
              </Link>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-lg aspect-square bg-blue-50 rounded-2xl overflow-hidden flex items-center justify-center">
            <Image 
                className="w-full h-full object-cover" 
                src={Home_img1} 
                alt="Hero Image"
                width={600}
                height={600}
                priority // Tells Next.js to load this instantly without waiting
              />
            </div>
          </div>

        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-800 w-full px-6 lg:px-48 xl:px-60 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            { value: "40%", label: "Reduced average wait time" },
            { value: "3x", label: "Faster patient throughput" },
            { value: "SMS", label: "Real-time updates for all patients" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl lg:text-4xl font-bold text-teal-400 mb-2">{stat.value}</div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features preview */}
      <section className="bg-gray-50 w-full px-6 lg:px-48 xl:px-60 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything your clinic needs</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            From priority queuing for seniors and PWDs to HMO fast lanes and doctor availability tracking.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Smart Priority Queue",
              desc: "Automatic priority for seniors, PWD, pregnant patients, and confirmed appointments.",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              ),
            },
            {
              title: "HMO Fast Lane",
              desc: "Parallel LOA tracking lane that never blocks the main queue. Admin secures LOA before patient enters.",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              ),
            },
            {
              title: "SMS Notifications",
              desc: "Patients without smartphones get SMS updates on queue position, delays, and document reminders.",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              ),
            },
          ].map((feature) => (
            <div key={feature.title} className="bg-white border border-gray-100 rounded-xl p-8">
              <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {feature.icon}
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-teal-700 w-full px-6 lg:px-48 xl:px-60 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to transform your clinic?</h2>
        <p className="text-teal-100 mb-8 max-w-xl mx-auto">
          Join clinics across the Philippines using KalQueue to serve patients better.
        </p>
        <Link
          href="/register"
          className="inline-block px-8 py-3 bg-white text-teal-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Start Today
        </Link>
      </section>
    </>
  );
}
