"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CTA() {
  return (
    <section id="marketplace" className="bg-[#0b120e] px-4 py-20 text-white sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#66e38f]">The ERS marketplace</p>
        <h2 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.04em] sm:text-6xl">
          Everyday errands, connected.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/60">
          Customers connect with runners through one clear experience, from describing an errand to following its progress.
        </p>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-[#111a15] p-6">
            <p className="text-lg font-bold">For customers</p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Explore how everyday requests move through the ERS marketplace.
            </p>
            <Link
              href="/how-it-works"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#66e38f]"
            >
              How it works <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-[#111a15] p-6">
            <p className="text-lg font-bold">For runners</p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Learn about the runner experience and the work available through ERS.
            </p>
            <Link
              href="/for-runners"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#66e38f]"
            >
              Explore the runner experience <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
