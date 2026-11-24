"use client";

export default function PressPage() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-white/80">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">
            Press
          </h1>
          <p className="text-white/50">
            ERS is building a connected marketplace for everyday errands, designed for Nigeria.
          </p>
        </div>

        {/* About ERS */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            About ERS
          </h2>
          <p className="leading-relaxed">
            ERS (Errand Runners System) is a platform that connects people with
            verified runners who can complete real-world tasks on demand.
            From deliveries to everyday errands, ERS helps users save time,
            avoid traffic, and get things done faster.
          </p>
        </section>

        {/* Key Highlights */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Key Highlights
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>A marketplace connecting customers and independent runners</li>
            <li>Everyday errands, organized around clearer coordination</li>
            <li>Built for Nigeria, with services and availability shaped over time</li>
            <li>Designed to make everyday tasks simpler to manage</li>
          </ul>
        </section>

        {/* Media Assets */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Media Assets
          </h2>
          <p className="text-white/60 mb-3">
            For logos, product screenshots, and brand assets, please contact us.
          </p>
          <p className="text-white/40">
            (Media kit coming soon)
          </p>
        </section>

        {/* Contact */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            Press Contact
          </h2>
          <p className="text-white mb-2">
            For media inquiries, interviews, or partnerships:
          </p>
          <a
            href="mailto:press@ers.com"
            className="text-[#1ED760] underline"
          >
            press@ers.com
          </a>
        </section>

        {/* Closing */}
        <section>
          <p className="text-white/50">
            We’re always open to sharing our story and collaborating with media partners.
          </p>
        </section>

      </div>
    </main>
  );
}