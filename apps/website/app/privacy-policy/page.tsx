"use client";

export default function PrivacyPolicy() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-white/80">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-2 text-white">
            Privacy Policy
          </h1>
          <p className="text-sm text-white/40">
            Last updated: 5 June 2026
          </p>
        </div>

        {/* Intro */}
        <p className="mb-6 leading-relaxed">
          ERS (Errand Runners System) respects your privacy and is committed to
          protecting your personal information. This Privacy Policy explains how
          we collect, use, and safeguard your data when you use our platform.
        </p>

        {/* 1 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            1. Information We Collect
          </h2>

          <h3 className="font-semibold mt-4 mb-2 text-white">
            Personal Information
          </h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Name, email, phone number</li>
            <li>Account and profile data</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-2 text-white">
            Location Data
          </h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Real-time GPS location</li>
            <li>Route tracking</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-2 text-white">
            Transaction Data
          </h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Errand details</li>
            <li>Payment records</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-2 text-white">
            Device Data
          </h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>IP address</li>
            <li>Device type</li>
            <li>Usage logs</li>
          </ul>
        </section>

        {/* 2 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            2. How We Use Data
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Match clients with runners</li>
            <li>Process errands and payments</li>
            <li>Improve platform performance</li>
            <li>Detect fraud and abuse</li>
            <li>Send updates and notifications</li>
          </ul>
        </section>

        {/* 3 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            3. Data Sharing
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Payment providers (e.g., Paystack)</li>
            <li>Hosting and infrastructure services</li>
            <li>Law enforcement when required</li>
          </ul>
          <p className="mt-3 text-white">
            We do not sell your personal data.
          </p>
        </section>

        {/* 4 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            4. Data Security
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Encrypted connections (HTTPS)</li>
            <li>Secure authentication systems</li>
            <li>Access control and monitoring</li>
          </ul>
        </section>

        {/* 5 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            5. Your Rights
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Access your data</li>
            <li>Request updates or corrections</li>
            <li>Request deletion</li>
            <li>Opt out of communications</li>
          </ul>
        </section>

        {/* 6 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            6. Data Retention
          </h2>
          <p>
            We retain data only as long as necessary for service delivery,
            legal compliance, and fraud prevention.
          </p>
        </section>

        {/* 7 */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            7. Updates
          </h2>
          <p>
            This policy may be updated periodically. Continued use of ERS
            means you accept the updated policy.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Contact
          </h2>
          <p>
            <a
              href="mailto:support@ers.com"
              className="text-[#1ED760] underline"
            >
              support@ers.com
            </a>
          </p>
        </section>

      </div>
    </main>
  );
}