export default function HowItWorksPage() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-white/80">
        <div className="mb-10">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#68e992]">
            Built for Nigeria
          </p>
          <h1 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
            A clearer way to get errands handled.
          </h1>
          <p className="text-white/60">
            How the ERS marketplace brings customers and independent runners together.
          </p>
        </div>

        <p className="mb-12 leading-relaxed">
          ERS connects people who need a hand with runners ready to help. The
          marketplace is designed to make everyday requests easier to describe,
          coordinate, and manage.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#111a15] p-6">
            <p className="text-sm font-bold text-[#68e992]">01</p>
            <h2 className="mb-2 mt-4 text-xl font-semibold text-white">
              Describe what you need
            </h2>
            <p className="text-white/70">
              Share the task, relevant pickup or drop-off details, and any
              instructions a runner should know.
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#111a15] p-6">
            <p className="text-sm font-bold text-[#68e992]">02</p>
            <h2 className="mb-2 mt-4 text-xl font-semibold text-white">
              Connect with a runner
            </h2>
            <p className="text-white/70">
              Independent runners can review requests and take on errands that
              fit their skills and schedule.
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#111a15] p-6">
            <p className="text-sm font-bold text-[#68e992]">03</p>
            <h2 className="mb-2 mt-4 text-xl font-semibold text-white">
              Coordinate the errand
            </h2>
            <p className="text-white/70">
              Keep the request and its details clear as the customer and runner
              coordinate the task.
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#111a15] p-6">
            <p className="text-sm font-bold text-[#68e992]">04</p>
            <h2 className="mb-2 mt-4 text-xl font-semibold text-white">
              Confirm completion
            </h2>
            <p className="text-white/70">
              Bring the errand to a clear close when the agreed task is
              complete.
            </p>
          </article>
        </div>

        <div className="mt-10 rounded-2xl border border-[#19c963]/20 bg-[#19c963]/[0.06] p-6">
          <h2 className="text-xl font-semibold text-white">
            Built around people
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-white/70">
            <li>Customers describe the help they need.</li>
            <li>Independent runners choose suitable requests.</li>
            <li>Service availability depends on the locations ERS supports.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}