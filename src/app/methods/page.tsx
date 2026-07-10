import Link from "next/link";
import { computeAnalyticsCached, MIN_N } from "@/lib/analytics";
import { MethodsProtocol } from "@/components/MethodsProtocol";

// Methods as its own citable page: a stable URL a skeptic can vet, cite in an
// argument, or drop into an onboarding doc (anchors m-01…m-06 are the public
// contract). Live values compute from the same rows as /results on every
// request — this page can never lag the ledger.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Judgment Call — Methods",
  description:
    "The protocol behind every published number: inclusion gates, the live sample, a position-bias self-check, thresholds, sources, and disclosure.",
};

export default async function MethodsPage() {
  const a = await computeAnalyticsCached();
  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="hero-line" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="masthead text-ink-strong">Judgment Call · Methods</p>
          <div className="datum mt-1.5" aria-hidden />
        </div>
        <h1
          className="hero-line mt-5 font-sans font-semibold text-[clamp(2rem,5.5vw,3rem)] leading-[1.05] tracking-[-0.03em] text-balance"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          How the numbers hold up.
        </h1>
        <p className="hero-line mt-3 text-sm text-muted" style={{ "--i": 2 } as React.CSSProperties}>
          The rules that shape every published number, and a check the study runs on itself. The
          live values below compute from the same rows as the{" "}
          <Link href="/results" className="text-accent hover:underline">
            results
          </Link>{" "}
          on every request.
        </p>

        <MethodsProtocol a={a} minN={MIN_N} />
      </div>
    </main>
  );
}
