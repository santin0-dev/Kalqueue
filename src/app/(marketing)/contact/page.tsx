"use client";

import { useState } from "react";
import { Input, Textarea, Button } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="w-full px-6 lg:px-16 xl:px-24 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
        <p className="text-gray-500 mb-8">
          Interested in bringing KalQueue to your clinic or hospital? Get in touch.
        </p>

        {submitted ? (
          <Card>
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto mb-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Message Sent</h2>
              <p className="text-gray-500">We&apos;ll get back to you within 2 business days.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="First Name" required />
                <Input label="Last Name" required />
              </div>
              <Input label="Email" type="email" required />
              <Input label="Clinic / Hospital Name" />
              <Textarea label="Message" required placeholder="Tell us about your clinic..." />
              <Button type="submit" className="w-full">Send Message</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
