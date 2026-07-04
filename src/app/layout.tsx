import type { Metadata } from "next";
import "@fontsource-variable/source-serif-4";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
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
