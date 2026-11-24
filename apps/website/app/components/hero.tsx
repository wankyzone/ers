import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#080d0a] text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_74%_45%,_rgba(25,201,99,0.12),_transparent_38%),linear-gradient(180deg,_#080d0a_0%,_#0b120e_100%)]"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="relative z-10">
          <Image
            src="/ers-logo.png"
            alt="ERS"
            width={180}
            height={48}
            priority
            className="h-10 w-auto"
          />

          <p className="mt-12 text-xs font-bold uppercase tracking-[0.24em] text-[#68e992] sm:mt-16">
            Errands, moving forward
          </p>

          <h1 className="mt-6 font-display text-[clamp(2.7rem,9vw,7.5rem)] font-extrabold leading-[0.88] tracking-[-0.075em]">
            <span className="block">YOUR ERRANDS</span>
            <span className="mt-2 block text-[#19c963]">HANDLED.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            ERS connects people who need a hand with runners ready to help,
            making everyday errands simpler, more visible and easier to manage.
          </p>
          <p className="mt-4 text-sm font-semibold tracking-wide text-white/85">
            Built for Nigeria.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/how-it-works"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#19c963] px-6 py-3 text-sm font-bold text-[#07110b] transition hover:bg-[#42df7d] focus-visible:outline-white"
            >
              Explore ERS <ArrowRight size={17} />
            </Link>
            <Link
              href="/for-runners"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-[#19c963]/70 hover:text-[#68e992]"
            >
              Become a runner
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex aspect-square w-full max-w-[500px] items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-[8%] rounded-full bg-[#19c963]/[0.07] blur-3xl"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 520 520"
            fill="none"
            className="absolute inset-0 h-full w-full"
          >
            <circle cx="260" cy="260" r="205" stroke="white" strokeOpacity=".07" />
            <circle cx="260" cy="260" r="157" stroke="white" strokeOpacity=".11" />
            <circle cx="260" cy="260" r="108" stroke="#19C963" strokeOpacity=".28" />
            <ellipse
              cx="260"
              cy="260"
              rx="205"
              ry="82"
              transform="rotate(-38 260 260)"
              stroke="#19C963"
              strokeOpacity=".34"
            />
            <ellipse
              cx="260"
              cy="260"
              rx="205"
              ry="82"
              transform="rotate(42 260 260)"
              stroke="white"
              strokeOpacity=".12"
            />
            <circle cx="91" cy="151" r="7" fill="#19C963" />
            <circle cx="427" cy="348" r="6" fill="white" fillOpacity=".8" />
            <circle cx="367" cy="94" r="4" fill="#19C963" />
          </svg>

          <div className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border border-[#19c963]/30 bg-[#0b120e]/90 shadow-[0_0_80px_rgba(25,201,99,0.12)] sm:h-44 sm:w-44">
            <Image
              src="/ers-logo.png"
              alt=""
              width={140}
              height={38}
              className="h-auto w-24 sm:w-28"
            />
            <span className="mt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Everyday, connected
            </span>
          </div>
          <span className="absolute bottom-[13%] right-[8%] rounded-full border border-white/10 bg-[#0c130f]/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55">
            Customers <span className="px-1 text-[#19c963]">·</span> Runners
          </span>
        </div>
      </div>
    </section>
  );
}
