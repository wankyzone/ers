"use client";

export default function PricingPage() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-white/80">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">
            Pricing
          </h1>
          <p className="text-white/50">
            Simple, transparent pricing — no surprises.
          </p>
        </div>

        {/* Key Value Proposition */}
        <div className="mb-12 p-6 bg-[#111217] border border-white/5 rounded-lg">
          <p className="text-lg text-white">
            Pay only when your errand is completed.
          </p>
          <p className="text-sm text-white/50 mt-2">
            No upfront payment. No hidden charges.
          </p>
        </div>

        {/* What Affects Pricing */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            What affects pricing
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Distance between locations</li>
            <li>Time required to complete the task</li>
            <li>Complexity of the errand</li>
            <li>Urgency or priority level</li>
          </ul>
        </section>

        {/* How Pricing Works */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            How pricing works
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Describe your errand and get a match</li>
            <li>See available runners and estimated cost</li>
            <li>Confirm and track your errand in real time</li>
            <li>Pay only after successful completion</li>
          </ul>
        </section>

        {/* Payment Model */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Payment model
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>No upfront payment required</li>
            <li>Escrow or postpaid system for protection</li>
            <li>Secure and verified transactions</li>
          </ul>
        </section>

        {/* Platform Fees */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Platform fees
          </h2>
          <p className="mb-3">
            ERS charges a small service fee to maintain platform quality,
            security, and reliability.
          </p>
          <p className="text-white/50">
            Fees are clearly shown before you confirm any errand.
          </p>
        </section>

        {/* Trust Reinforcement */}
        <section className="mb-12 p-6 bg-[#111217] border border-white/5 rounded-lg">
          <h2 className="text-xl font-semibold text-white mb-3">
            No surprises. Full control.
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-white/70">
            <li>You see pricing before confirming</li>
            <li>You only pay after completion</li>
            <li>You can report issues if something goes wrong</li>
          </ul>
        </section>

        {/* Closing */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-white/50">
            Create your first errand and see pricing instantly.
          </p>
        </section>

      </div>
    </main>
  );
}