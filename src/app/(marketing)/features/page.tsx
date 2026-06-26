const features = [
  {
    title: "Dynamic Priority Queue",
    description: "Positions computed in real-time based on patient category, appointment status, and arrival time. Never stored, always accurate.",
  },
  {
    title: "Capacity Block Management",
    description: "Configurable appointment/walk-in ratios per clinic. Prevents walk-in overflow while honoring scheduled appointments.",
  },
  {
    title: "HMO Parallel Lane",
    description: "HMO patients enter a separate LOA tracking lane. Admin secures Letter of Authorization before they join the main queue with priority bonus.",
  },
  {
    title: "Doctor Availability",
    description: "Doctors declare availability windows. Mark delayed or absent, system auto-reschedules and notifies affected patients.",
  },
  {
    title: "Real-time Updates",
    description: "Pusher-powered live queue updates on patient, doctor, and clinic dashboards. No page refresh needed.",
  },
  {
    title: "SMS-First Notifications",
    description: "Twilio SMS for booking confirmations, queue position alerts, delay notices, and post-visit summaries.",
  },
  {
    title: "Intake & Document Checklist",
    description: "Smart intake forms map chief complaints to required documents, school medical, travel visa, HMO consult, and more.",
  },
  {
    title: "Consultation Records",
    description: "Doctors complete consultation records with findings, prescriptions, and follow-up dates. Prior visit summaries pre-populated.",
  },
  {
    title: "Admin Dashboard",
    description: "Clinic-wide queue overview, HMO fast lane management, capacity config, announcements, and reporting.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="w-full px-6 lg:px-16 xl:px-24 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Platform Features</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Everything you need to manage patient flow across multiple departments and doctor schedules.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((feature) => (
          <div key={feature.title} className="bg-white border border-gray-100 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
