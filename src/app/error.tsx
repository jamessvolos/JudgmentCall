"use client";

import Link from "next/link";

// Route-level error boundary. Catches render/data errors on any page under the
// root layout and offers a retry (reset re-renders the segment). Utility copy
// stays plain (docs/VOICE.md); the digest gives support a searchable reference.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
          <p className="masthead text-ink-strong">Judgment Call</p>
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        </div>
        <div className="double-rule mt-3" aria-hidden />
        <div className="mt-10 rounded-card border border-card-border bg-card px-5 py-6 text-center shadow-[var(--shadow-card)]">
          <p className="kicker text-muted">Something went wrong</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            This page hit an error and stopped. A retry usually clears it; nothing you logged is
            lost.
          </p>
          <button
            onClick={reset}
            className="mt-5 w-full rounded-md border border-rule-strong bg-card px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-strong transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
          <p className="mt-3 font-mono text-xs text-muted">
            or{" "}
            <Link href="/" className="text-accent underline-offset-4 hover:underline">
              back to the front page
            </Link>
          </p>
          {error.digest && (
            <p className="mt-5 font-mono text-[0.65rem] text-muted/70">ref {error.digest}</p>
          )}
        </div>
      </div>
    </main>
  );
}
