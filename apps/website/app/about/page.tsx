export default function AboutPage() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="mb-20">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-[#1ED760]">
            Built for Nigeria
          </p>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
            Everyday errands, connected.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/60">
            ERS connects people who need a hand with runners ready to help,
            making everyday errands simpler, more visible and easier to manage.
          </p>
        </div>

        <div className="mb-20">
          <h2 className="text-sm tracking-widest text-[#1ED760] mb-4">
            WHY ERS
          </h2>
          <p className="leading-relaxed text-white/70">
            Everyday logistics can take time and attention away from work,
            family, and other priorities.
          </p>
          <p className="mt-4 leading-relaxed text-white/70">
            ERS is built around a simple idea: bring customers and independent
            runners together to make everyday tasks easier to coordinate.
          </p>
        </div>

        <div className="mb-20">
          <h2 className="text-sm tracking-widest text-[#1ED760] mb-4">
            WHAT ERS DOES
          </h2>
          <p className="leading-relaxed text-white/70">
            Customers describe the help they need. Runners can take on suitable
            requests through the ERS marketplace.
          </p>
          <p className="mt-4 leading-relaxed text-white/70">
            The marketplace is designed to make requests and coordination
            clearer, with room to grow into more independent services and
            categories over time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-20">
          <div>
            <h2 className="text-sm tracking-widest text-[#1ED760] mb-4">
              MISSION
            </h2>
            <p className="leading-relaxed text-white/70">
              Make everyday errands simpler to request, coordinate, and manage.
            </p>
          </div>
          <div>
            <h2 className="text-sm tracking-widest text-[#1ED760] mb-4">
              VISION
            </h2>
            <p className="leading-relaxed text-white/70">
              Build a more connected marketplace for everyday services.
            </p>
          </div>
        </div>

        <div className="mb-20">
          <h2 className="text-sm tracking-widest text-[#1ED760] mb-4">
            WHAT SHAPES ERS
          </h2>
          <ul className="space-y-4 text-white/70">
            <li>• Built for the needs and realities of Nigeria</li>
            <li>• A marketplace connecting customers and independent runners</li>
            <li>• Clearer coordination from request through completion</li>
            <li>• A foundation that can grow with new services and categories</li>
          </ul>
        </div>

        <div className="mb-20">
          <h2 className="text-sm tracking-widest text-[#1ED760] mb-4">
            WHERE WE ARE HEADED
          </h2>
          <p className="leading-relaxed text-white/70">
            ERS is developing a connected marketplace that helps customers and
            runners coordinate everyday tasks with greater clarity.
          </p>
        </div>

        <div className="border-t border-white/10 pt-10">
          <p className="text-white/50 text-sm">
            Your errands handled. Built for Nigeria.
          </p>
        </div>
      </div>
    </main>
  );
}