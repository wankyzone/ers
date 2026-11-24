"use client";

import { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "highlight";
  className?: string;
};

export default function SectionCard({
  title,
  children,
  icon,
  variant = "default",
  className = "",
}: SectionCardProps) {
  const isHighlight = variant === "highlight";

  return (
    <section
      className={`
        group
        border rounded-2xl
        bg-[#111217]
        p-6
        transition-all duration-300
        hover:-translate-y-1
        ${isHighlight ? "border-[#1ED760]/30 bg-[#1ED760]/5" : "border-white/10 hover:border-white/20"}
        ${className}
      `}
    >

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">

        {icon && (
          <div className="
            w-8 h-8 flex items-center justify-center
            rounded-lg bg-white/5
            group-hover:scale-110 transition
          ">
            {icon}
          </div>
        )}

        <h2 className={`
          text-lg font-semibold transition
          ${isHighlight ? "text-[#1ED760]" : "text-white group-hover:text-[#1ED760]"}
        `}>
          {title}
        </h2>

      </div>

      {/* Content */}
      <div className="text-white/60 leading-relaxed text-sm">
        {children}
      </div>

    </section>
  );
}