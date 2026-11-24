"use client";

export default function TermsOfService() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-white/80">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-2 text-white">
            Terms of Service
          </h1>
          <p className="text-sm text-white/40">
            Last updated: 5 June 2026
          </p>
        </div>

        {/* Intro */}
        <p className="mb-6 leading-relaxed">
          By accessing or using ERS (Errand Runners System), you agree to be bound
          by these Terms of Service. If you do not agree to these Terms, you may not
          use the platform.
        </p>

        {/* 1. Platform Overview */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            1. Platform Overview
          </h2>
          <p>
            ERS is a technology platform that connects clients with independent
            runners. Runners are independent contractors and not employees of ERS.
            ERS does not perform errands and is not responsible for execution,
            quality, or safety of services performed by users.
          </p>
        </section>

        {/* 2. User Responsibilities */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            2. User Responsibilities
          </h2>

          <h3 className="font-semibold mt-4 mb-2 text-white">Clients</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Provide accurate errand details</li>
            <li>Ensure timely payment</li>
            <li>Respect runners</li>
          </ul>

          <h3 className="font-semibold mt-6 mb-2 text-white">Runners</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Complete errands as agreed</li>
            <li>Act professionally</li>
            <li>Follow applicable laws</li>
          </ul>
        </section>

        {/* 3. Payments */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            3. Payments
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>ERS may process payments including service fees</li>
            <li>Payments may use escrow or postpaid systems</li>
            <li>Late payment may result in penalties or restrictions</li>
            <li>Fees are non-refundable unless required by law</li>
          </ul>
        </section>

        {/* 4. Cancellations */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            4. Cancellations & Disputes
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Errands may be cancelled under platform rules</li>
            <li>Disputes are handled by ERS</li>
            <li>ERS decisions are final</li>
          </ul>
        </section>

        {/* 5. Suspension */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            5. Account Suspension
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Fraud or illegal activity</li>
            <li>Abuse or misconduct</li>
            <li>Violation of terms</li>
          </ul>
        </section>

        {/* 6. Liability */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            6. Limitation of Liability
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Loss or damage of items</li>
            <li>User misconduct</li>
            <li>Delays due to external factors</li>
          </ul>
        </section>

        {/* 7. Governing Law */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            7. Governing Law
          </h2>
          <p>
            These Terms are governed by the laws of the Federal Republic of Nigeria.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Contact
          </h2>
          <p>
            support@ers.com
          </p>
        </section>

      </div>
    </main>
  );
}