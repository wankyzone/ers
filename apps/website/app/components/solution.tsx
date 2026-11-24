import { ArrowRight, Clock3, MapPin, ShieldCheck } from "lucide-react";

const features = [
  { title: "Save time", description: "Hand off the physical work so you can keep your attention on what matters.", icon: Clock3 },
  { title: "Stay in control", description: "Know what is happening with your errand instead of wondering where it stands.", icon: MapPin },
  { title: "Build trust", description: "Verification, communication and a structured completion flow keep the experience accountable.", icon: ShieldCheck },
];

export default function Solution() {
  return (
    <section className="bg-[#0b120e] px-4 py-20 text-white sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#68e992]">Why ERS</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
              Less running around. More getting things done.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/55">
            ERS turns a real-world errand into a visible, structured process — from creating the request to confirming completion.
          </p>
        </div>

        <div className="mt-12 grid overflow-hidden rounded-[30px] border border-white/10 bg-[#080d0a] md:grid-cols-3">
          {features.map(({ title, description, icon: Icon }, index) => (
            <article key={title} className={`p-7 sm:p-9 ${index > 0 ? "border-t border-white/10 md:border-l md:border-t-0" : ""}`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#19c963] text-white shadow-[0_10px_25px_rgba(25,201,99,0.35)]">
                <Icon size={21} />
              </div>
              <h3 className="mt-8 text-xl font-bold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">{description}</p>
              <div className="mt-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#66e38f]">
                Built into ERS <ArrowRight size={14} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
