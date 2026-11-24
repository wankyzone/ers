"use client";

import { Star } from "lucide-react";

type Testimonial = {
  name: string;
  role: string;
  quote: string;
  rating: number;
};

const testimonials: Testimonial[] = [
  {
    name: "Tunde A.",
    role: "Business Owner",
    quote:
      "Saved me 3 hours in traffic. I use ERS almost every day now.",
    rating: 5,
  },
  {
    name: "Ada E.",
    role: "Product Designer",
    quote:
      "Way more reliable than dispatch riders. I actually trust this.",
    rating: 5,
  },
  {
    name: "Ibrahim M.",
    role: "Student",
    quote:
      "Didn’t expect it to be this fast. My errand was done in under 20 minutes.",
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="px-5 sm:px-8 py-24 max-w-6xl mx-auto">

      {/* Header */}
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
          Everyday errands, connected
        </h2>

        <p className="text-white/60 max-w-xl mx-auto">
          Real experiences from people using ERS to save time every day.
        </p>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">

        {testimonials.map((t, i) => (
          <div
            key={i}
            className="
              p-6 rounded-xl
              border border-white/5
              bg-[#111217]
              transition-all duration-300
              hover:border-white/10
              hover:-translate-y-1
              hover:shadow-[0_0_30px_rgba(30,215,96,0.06)]
            "
          >

            {/* Rating */}
            <div className="flex gap-1 mb-4">
              {Array.from({ length: t.rating }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className="text-[#1ED760] fill-[#1ED760]"
                />
              ))}
            </div>

            {/* Quote */}
            <p className="text-white/80 leading-relaxed mb-6 text-sm">
              “{t.quote}”
            </p>

            {/* Divider */}
            <div className="h-px w-full bg-white/5 mb-4" />

            {/* User */}
            <div className="flex flex-col text-sm">
              <span className="text-white font-medium">
                {t.name}
              </span>

              <span className="text-white/40">{t.role}</span>
            </div>

          </div>
        ))}

      </div>

      {/* CTA (CRITICAL) */}
      <div className="mt-20 text-center">
        <p className="text-white/50 mb-6">
          See how customers and runners connect through ERS.
        </p>

        <a
          href="/how-it-works"
          className="
            inline-block
            bg-[#1ED760] text-black
            px-8 py-4 rounded-md
            font-semibold
            hover:bg-[#17c253]
            transition
          "
        >
          How it works
        </a>
      </div>

    </section>
  );
}