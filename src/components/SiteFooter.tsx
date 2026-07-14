import Link from "next/link";

// The colophon: quiet, mono, hairline-ruled — every public page ends the same
// way a broadsheet does. Also the only global navigation surface, so /review
// and /drill stay discoverable outside their happy paths.
export function SiteFooter() {
  return (
    <footer className="print-hide px-5 pb-8 pt-10 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="h-px w-full bg-card-border" aria-hidden />
        <nav className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
          <Link href="/" className="hover:text-foreground hover:underline">
            Vote
          </Link>
          <Link href="/results" className="hover:text-foreground hover:underline">
            Results
          </Link>
          <Link href="/review" className="hover:text-foreground hover:underline">
            Review
          </Link>
          <Link href="/drill" className="hover:text-foreground hover:underline">
            Train
          </Link>
          <Link href="/results#desk-calls" className="hover:text-foreground hover:underline">
            The Desk&apos;s Calls
          </Link>
          <Link href="/methods" className="hover:text-foreground hover:underline">
            Methods
          </Link>
          <span className="ml-auto tracking-[0.18em] uppercase">Judgment Call</span>
        </nav>
      </div>
    </footer>
  );
}
