import type { Metadata } from "next";
import localFont from "next/font/local";
// DATUM type system: Geist (display + body) + Geist Mono (the data voice).
// Source Serif 4 is retained only for the desk's first-person voice, the
// poster's leaning values, and the voting tellings.
//
// Loaded through next/font/local off the @fontsource-variable woff2 files
// already on disk (no build-time network — the sandbox blocks next/font/google).
// This self-hosts, auto-injects <link rel=preload> for the faces used above the
// fold (killing the hero/masthead FOUT), applies size-adjust fallback metrics
// to cut CLS, and emits ONLY the latin faces we use — the old `import
// "@fontsource-variable/geist"` shipped @font-face for five scripts × normal +
// italic, none preloaded. Geist/Geist-Mono carry no italic (italics are always
// Source Serif); Source Serif ships normal + italic (the poster's hedged values).
// IBM Plex Mono is intentionally absent — it is used only by the OG image
// generator (src/lib/og.tsx reads its woff files directly).
// The latin variable woff2 are copied into ./fonts from the @fontsource-variable
// packages (next/font/local needs app-local paths, not node_modules). Refresh
// them if the package versions bump.
const geistSans = localFont({
  src: "./fonts/geist-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-sans",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});
const geistMono = localFont({
  src: "./fonts/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",
  fallback: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
});
const sourceSerif = localFont({
  src: [
    { path: "./fonts/source-serif-4-latin-wght-normal.woff2", weight: "200 900", style: "normal" },
    { path: "./fonts/source-serif-4-latin-wght-italic.woff2", weight: "200 900", style: "italic" },
  ],
  display: "swap",
  variable: "--font-source-serif",
  fallback: ["Iowan Old Style", "Palatino", "Georgia", "serif"],
  // Serif is never the hero — it carries the voting tellings and desk quotes,
  // which are never the LCP element. Preloading its two faces (~100KB) on every
  // route (including the serif-free landing) would only crowd the critical path;
  // let it load on demand where it actually renders. Geist sans + mono stay
  // preloaded — they're above the fold on every surface.
  preload: false,
});
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";

const description =
  "Two tellings of the same data insight. Tap the better one. Your votes feed a live, public study of what makes a data story land.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL in production so OG/twitter URLs are absolute.
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: "Judgment Call — a live study of data storytelling",
    template: "%s · Judgment Call",
  },
  description,
  openGraph: {
    title: "Judgment Call",
    description,
    siteName: "Judgment Call",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Judgment Call",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
