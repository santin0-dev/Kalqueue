import Link from "next/link";

export default function AboutPage() {
  const objectives = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      title: "Vulnerable Care Priority",
      desc: "Automatically routes and manages priority queues for seniors, PWDs, and pregnant women to guarantee fair, specialized flow alignment.",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "HMO Fast-Tracking",
      desc: "Isolates parallel Letter of Authorization (LOA) tracking lanes so paperwork delays securely resolve without blocking general clinic throughput.",
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      title: "Inclusive SMS Tracking",
      desc: "Broadcasts live updates on queue positions and documentation reminders via automated SMS, fully supporting patients without smartphones.",
    },
  ];

  // ─── RENDERING THE COMPOSITE VIEW ─────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-white">
      
      {/* 1. Page Hero Section */}
      <section className="pt-32 pb-16 bg-gray-50 w-full text-center">
        <div className="w-full px-6 lg:px-16 xl:px-24">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">About KalQueue</h1>
          <p className="text-gray-500 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Built for Philippine Healthcare. Designed for dignity. A smarter queue management platform serving public health centers, community hospitals, and private clinics.
          </p>
        </div>
      </section>

      {/* 2. Detailed Split Intro Section */}
      <section className="py-24 bg-white w-full">
        <div className="w-full px-6 lg:px-48 xl:px-60">
          <div className="grid md:grid-cols-2 gap-16 items-center">


            <div>
              <div className="w-10 h-0.5 bg-teal-600 mb-5 rounded-full" />
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-5">Smarter Patient Flow</h2>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-4">
                KalQueue was built to address the unique, everyday challenges of Philippine healthcare, long wait times, crowded waiting rooms, complex HMO paperwork bottlenecks, and the urgent need to look out for vulnerable patients.
              </p>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-4">
                Our platform unifies the entire queue management system. It dynamically bridges parallel registration channels so that scheduled bookings, urgent walk-ins, and complex HMO verifications never gridlock the clinic desk or conflict with each other.
              </p>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-8">
                By keeping everyone informed in real-time, including feature-rich interfaces for staff and accessible SMS notifications for patients without smartphones, KalQueue brings transparency and structural peace to community clinic waiting spaces.
              </p>

              {/* Internal Mission & Vision Cards Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="border-l-4 border-teal-600 pl-4 py-3 bg-gray-50 rounded-r-lg">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Our Mission</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    To make healthcare access fair, transparent, and efficient for every Filipino, whether they walk in, have an appointment, or come through HMO coverage.
                  </p>
                </div>
                <div className="border-l-4 border-teal-600 pl-4 py-3 bg-gray-50 rounded-r-lg">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1.5">Our Vision</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    A Philippine healthcare ecosystem where vulnerable groups are seamlessly prioritized and all patients are served with equal order and absolute dignity.
                  </p>
                </div>
              </div>
            </div>


            <div className="flex justify-center">
              <div className="w-full max-w-md aspect-[4/3] bg-blue-50 rounded-2xl flex flex-col items-center justify-center gap-3 text-blue-200">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <p className="text-xs">Hospital & Clinic Systems</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Three-Column Pillars Section */}
      <section className="py-24 bg-gray-50 w-full">
        <div className="w-full px-6 lg:px-48 xl:px-60">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Core Focus Areas</h2>
            <p className="text-gray-500 text-sm md:text-base max-w-md mx-auto leading-relaxed">
              Three systemic bottlenecks. Three tailored solutions. One single unified system.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {objectives.map((obj) => (
              <div key={obj.title} className="bg-white border border-gray-100 rounded-xl p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-700 mx-auto mb-4">
                  {obj.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 text-lg">{obj.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{obj.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

    </div>
  );
}