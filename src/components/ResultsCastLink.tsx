"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Embed mode (?embed=1) resolved client-side so /results can prerender (ISR):
// reading searchParams on the server would force per-request rendering for
// every visitor. This island stamps data-embed on <main> — globals.css then
// hides the colophon and any .embed-hide chrome — and points the CTA at a new
// tab so the host article's iframe never navigates away.
export function ResultsCastLink() {
  const embed = useSearchParams().get("embed") === "1";
  useEffect(() => {
    if (embed) document.querySelector("main")?.setAttribute("data-embed", "1");
  }, [embed]);
  return (
    <Link
      href="/"
      {...(embed && { target: "_blank" })}
      className="font-semibold text-accent hover:underline"
    >
      Cast your own votes{embed ? " at judgment-call.vercel.app" : ""} →
    </Link>
  );
}
