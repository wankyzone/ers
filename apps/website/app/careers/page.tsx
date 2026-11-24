"use client";

export default function CareersPage() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-20">

        {/* HERO */}
        <div className="mb-16">
          <p className="text-xs tracking-widest text-[#1ED760] mb-4">
            CAREERS
          </p>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Build the future of errands in Africa
          </h1>

          <p className="text-white/60 text-lg max-w-2xl">
            ERS is building the infrastructure for real-world task execution across cities.
            If you want to work on meaningful problems, move fast, and take ownership —
            you’ll fit right in.
          </p>
        </div>

        {/* WHY JOIN */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">
            Why join ERS
          </h2>

          <div className="grid gap-6">

            <div className="bg-[#111217] border border-white/10 p-6 rounded-xl">
              <h3 className="font-semibold mb-2">
                Work on real-world impact
              </h3>
              <p className="text-white/60 text-sm">
                Your work directly affects how people move, work, and save time daily.
              </p>
            </div>

            <div className="bg-[#111217] border border-white/10 p-6 rounded-xl">
              <h3 className="font-semibold mb-2">
                High ownership, zero bureaucracy
              </h3>
              <p className="text-white/60 text-sm">
                No layers. No delays. You ship fast and see results immediately.
              </p>
            </div>

            <div className="bg-[#111217] border border-white/10 p-6 rounded-xl">
              <h3 className="font-semibold mb-2">
                Early-stage upside
              </h3>
              <p className="text-white/60 text-sm">
                Join early and grow with the company as we scale across cities.
              </p>
            </div>

          </div>
        </section>

        {/* WHO WE'RE LOOKING FOR */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">
            Who we&apos;re looking for
          </h2>

          <ul className="space-y-3 text-white/60 text-sm">
            <li>• You move fast and execute without constant supervision</li>
            <li>• You care about building real products, not just writing code</li>
            <li>• You take ownership and solve problems end-to-end</li>
            <li>• You are comfortable with ambiguity and rapid iteration</li>
          </ul>
        </section>

        {/* ROLES */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">
            Open roles
          </h2>

          <div className="grid gap-4">

            {[
              "Frontend Engineer",
              "Backend Engineer",
              "Product Designer",
              "Operations Lead",
            ].map((role, i) => (
              <div
                key={i}
                className="
                  flex items-center justify-between
                  bg-[#111217]
                  border border-white/10
                  px-5 py-4 rounded-xl
                  hover:border-white/20 transition
                "
              >
                <span>{role}</span>

                <span className="text-[#1ED760] text-sm">
                  Apply →
                </span>
              </div>
            ))}

          </div>
        </section>

        {/* CTA */}
        <section className="text-center">

          <h2 className="text-2xl font-semibold mb-4">
            Think you’re a fit?
          </h2>

          <p className="text-white/60 mb-6">
            Send your portfolio or GitHub and a short intro.
          </p>

          <a
            href="mailto:careers@ers.com"
            className="
              inline-block
              bg-[#1ED760] text-black
              px-8 py-4 rounded-md
              font-semibold
              hover:bg-[#17c253]
              transition
            "
          >
            Apply now
          </a>

        </section>

      </div>
    </main>
  );
}