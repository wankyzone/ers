"use client";

export default function ForRunnersPage() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-white/80">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">
            Earn on your terms
          </h1>
          <p className="text-white/50">
            Complete errands, make money, and work on your own schedule.
          </p>
        </div>

        {/* Earnings Hook */}
        <div className="mb-12 p-6 bg-[#111217] border border-white/5 rounded-lg">
          <p className="text-lg text-white">
            Get paid for every task you complete.
          </p>
          <p className="text-sm text-white/50 mt-2">
            No fixed hours. No limits on how much you can earn.
          </p>
        </div>

        {/* How it works */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            How it works
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Complete account setup and verification</li>
            <li>Browse errands near you</li>
            <li>Accept and complete tasks</li>
            <li>Get paid after completion</li>
          </ul>
        </section>

        {/* Why join */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Why join ERS
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Flexible schedule — work anytime</li>
            <li>Earn per task — no salary limits</li>
            <li>Choose errands within your area</li>
            <li>Grow your income with consistent work</li>
          </ul>
        </section>

        {/* Trust */}
        <section className="mb-12 p-6 bg-[#111217] border border-white/5 rounded-lg">
          <h2 className="text-xl font-semibold text-white mb-3">
            Reliable payments
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-white/70">
            <li>Secure payout system</li>
            <li>Transparent earnings per task</li>
            <li>Dispute support if issues arise</li>
          </ul>
        </section>

        {/* Requirements */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Requirements
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Smartphone with GPS</li>
            <li>Reliable transport</li>
            <li>Good communication skills</li>
            <li>Professional attitude</li>
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center mt-16">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Interested in running with ERS?
          </h2>
          <p className="text-white/50 mb-6">
            Runner applications are not available through this website yet.
          </p>
        </div>

      </div>
    </main>
  );
}