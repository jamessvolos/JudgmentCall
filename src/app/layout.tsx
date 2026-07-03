import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Judgment Call",
  description:
    "Two versions of the same data insight. Tap the better one. Your votes reveal what makes an insight land.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
