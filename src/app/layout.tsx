import type { Metadata } from "next";
// DATUM type system: Geist (display + body) + Geist Mono (the data voice).
// Source Serif 4 is retained only for the desk's first-person voice, the
// poster's leaning values, and the voting tellings.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/source-serif-4";
// IBM Plex Mono is NOT loaded here — it is used only by the OG image generator
// (src/lib/og.tsx reads its woff files directly). The client's data voice is
// Geist Mono (--font-mono).
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
