import { CheckCircle2, ClipboardEdit, UserCheck } from "lucide-react";

const steps = [
  { number: "01", title: "Tell us what you need", desc: "Describe the errand, where it needs to happen, and where the result should go.", icon: ClipboardEdit },
  { number: "02", title: "A runner handles it", desc: "A verified runner accepts the errand and gets to work.", icon: UserCheck },
  { number: "03", title: "Track it to completion", desc: "Stay updated while your runner completes the task and confirm when it is done.", icon: CheckCircle2 },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#0b120e] px-4 py-20 text-white sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#68e992]">Simple process</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
            From “I need this done” to done.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map(({ number, title, desc, icon: Icon }) => (
            <article key={number} className="rounded-[28px] border border-white/10 bg-[#111a15] p-7 transition hover:-translate-y-1 hover:border-[#19c963]/35">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-[#68e992]">{number}</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#19c963] text-[#07110b] shadow-sm">
                  <Icon size={20} />
                </div>
              </div>
              <h3 className="mt-8 text-xl font-bold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
