"use client";

import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#0b120e] px-4 pb-8 pt-14 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-3 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center">
              <Image src="/ers-logo.png" alt="ERS logo" width={180} height={48} className="h-10 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/60">
              A marketplace connecting people who need a hand with runners ready to help.
            </p>
          </div>
          <p className="max-w-sm text-sm leading-6 text-white/45">
            Built for Nigeria. Everyday errands, connected.
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4 lg:gap-8">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/70">Product</h2>
            <div className="mt-3 flex flex-col text-sm text-white/55">
              <Link href="/how-it-works" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">How it works</Link>
              <Link href="/#services" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Explore services</Link>
              <Link href="/how-it-works" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">For Customers</Link>
              <Link href="/for-runners" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">For Runners</Link>
              <Link href="/safety" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Safety &amp; trust</Link>
              <Link href="/pricing" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Pricing</Link>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/70">Company</h2>
            <div className="mt-3 flex flex-col text-sm text-white/55">
              <Link href="/about" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">About ERS</Link>
              <Link href="/blog" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">ERS Updates</Link>
              <Link href="/careers" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Careers</Link>
              <Link href="/press" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Press</Link>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/70">Ecosystem</h2>
            <div className="mt-3 flex flex-col text-sm text-white/55">
              <a href="https://wankysoftware.com/" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Wanky Technologies</a>
              <a href="https://wankycloud.wankysoftware.com/" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Wanky Cloud</a>
              <span className="flex min-h-11 items-center px-1">Wanky</span>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/70">Legal</h2>
            <div className="mt-3 flex flex-col text-sm text-white/55">
              <Link href="/privacy-policy" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Privacy Policy</Link>
              <Link href="/terms-of-service" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Terms of Service</Link>
              <Link href="/cookie-policy" className="flex min-h-11 items-center rounded-sm px-1 transition-colors hover:text-[#19c963] focus-visible:text-[#19c963]">Cookie Policy</Link>
            </div>
          </div>
        </nav>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ERS — Errand Runners System.</p>
          <p>Built for Nigeria.</p>
        </div>
      </div>
    </footer>
  );
}
