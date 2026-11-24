import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans } from "next/font/google";
import CookieBanner from "./components/CookieBanner";
import Analytics from "./components/Analytics";
import { getSiteUrl, isProductionDeployment } from "../lib/site-config";

// Display font — distinctive, strong, memorable
const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

// Body font — clean, legible at small sizes
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
});

const SITE_URL = getSiteUrl();
const IS_INDEXABLE = isProductionDeployment();

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: "ERS — Your Errands Handled",
    template: "%s | ERS",
  },
  description:
    "Built for Nigeria. ERS connects people who need a hand with runners ready to help, making everyday errands simpler, more visible and easier to manage.",
  keywords: [
    "errands Nigeria",
    "errand runners",
    "errand marketplace",
    "everyday errands",
    "ERS",
  ],
  authors: [{ name: "ERS" }],
  creator: "ERS",
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: SITE_URL.toString(),
    siteName: "ERS",
    title: "ERS — Your Errands Handled",
    description:
      "Built for Nigeria. ERS connects people who need a hand with runners ready to help.",
    images: [
      {
        url: "/ers-logo.png",
        alt: "ERS — Your Errands Handled",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ERS — Your Errands Handled",
    description:
      "Built for Nigeria. Everyday errands, connected.",
    images: ["/ers-logo.png"],
  },
  robots: {
    index: IS_INDEXABLE,
    follow: IS_INDEXABLE,
    googleBot: {
      index: IS_INDEXABLE,
      follow: IS_INDEXABLE,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0D12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ERS",
    url: SITE_URL.toString(),
    description:
      "A connected marketplace built for Nigeria, bringing together people who need a hand and runners ready to help with everyday errands.",
    serviceType: "Errand Running Service",
  };

  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* LD+JSON must be in <head> for crawlers — not afterInteractive */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
        />
      </head>
      <body className="bg-[#0B0D12] text-white antialiased font-sans">
        {children}
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}