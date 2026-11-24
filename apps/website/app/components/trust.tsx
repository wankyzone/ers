import { LockKeyhole, MapPin, ShieldCheck, WalletCards } from "lucide-react";

const trustPoints = [
  { title: "Runner verification", description: "ERS includes a verification process designed to establish runner identity and accountability.", icon: ShieldCheck },
  { title: "In-app communication", description: "Clients and runners can communicate through the ERS experience instead of relying on scattered channels.", icon: LockKeyhole },
  { title: "Real-time visibility", description: "Track an active errand and understand its progress while it is being completed.", icon: MapPin },
  { title: "Structured payments", description: "ERS is designed around verified payments, escrow and completion confirmation.", icon: WalletCards },
];

export default function Trust() {
  return (
    <section className="bg-[#080d0a] px-4 py-20 text-white sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#68e992]">Trust & safety</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
            Built around visibility, accountability and control.
          </h2>
          <p className="mt-5 text-base leading-7 text-white/55">
            The goal is simple: make a real-world errand feel as structured and visible as the digital products you already trust.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trustPoints.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-[26px] border border-white/10 bg-[#111a15] p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#19c963]/10 text-[#68e992]">
                <Icon size={20} />
              </div>
              <h3 className="mt-6 text-base font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
