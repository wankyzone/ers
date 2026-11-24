"use client";

export default function SafetyPage() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-white/80">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">
            Safety & Trust
          </h1>
          <p className="text-white/50">
            Built to protect both clients and runners at every step.
          </p>
        </div>

        {/* Intro */}
        <p className="mb-10 leading-relaxed">
          ERS is designed with safety, accountability, and transparency at its core.
          Every interaction on the platform is structured to minimize risk and
          ensure reliable outcomes for both clients and runners.
        </p>

        {/* Verified Users */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Verified users
          </h2>
          <p className="mb-3">
            All runners undergo identity and profile verification before they are
            allowed to accept errands.
          </p>
          <p>
            This ensures accountability and helps maintain a trusted network of
            individuals on the platform.
          </p>
        </section>

        {/* Tracking */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Real-time tracking
          </h2>
          <p className="mb-3">
            Clients can monitor their errands in real time, from assignment to
            completion.
          </p>
          <p>
            This visibility reduces uncertainty and allows users to stay informed
            throughout the process.
          </p>
        </section>

        {/* Payments */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Secure payments
          </h2>
          <p className="mb-3">
            Payments are handled through controlled systems including escrow and
            postpaid authorization flows.
          </p>
          <p>
            This ensures that runners are paid fairly and clients are protected
            from incomplete or unsatisfactory service.
          </p>
        </section>

        {/* Disputes */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Dispute resolution
          </h2>
          <p className="mb-3">
            If an issue arises, ERS provides structured dispute handling through
            its admin system.
          </p>
          <p>
            Cases are reviewed based on available data, communication logs, and
            task details to ensure fair outcomes.
          </p>
        </section>

        {/* Risk Handling */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-white mb-4">
            What happens if something goes wrong?
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Issues can be reported directly within the platform</li>
            <li>Support and admin teams review and intervene when necessary</li>
            <li>Appropriate actions are taken based on investigation outcomes</li>
          </ul>
        </section>

        {/* Closing */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">
            Our commitment
          </h2>
          <p>
            We continuously improve our systems, monitoring, and safeguards to
            ensure that ERS remains a reliable and secure platform for everyday
            errands.
          </p>
        </section>

      </div>
    </main>
  );
}