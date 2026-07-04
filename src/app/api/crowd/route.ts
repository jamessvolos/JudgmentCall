import { NextResponse } from "next/server";
import { withTiming } from "@/lib/timing";
import { computeAnalyticsCached } from "@/lib/analytics";

// Public, unsuppressed crowd win rates — powers "your taste vs the crowd".
// These numbers are eventually-consistent by design (published only at n≥30),
// so a short shared-cache TTL at the CDN is safe and takes the read off the
// function entirely for the common case (perf wave 5). stale-while-revalidate
// keeps it instant even at the TTL boundary.
async function getHandler(): Promise<Response> {
  const a = await computeAnalyticsCached();
  return NextResponse.json(
    {
      totals: a.totals, // same public headline numbers as /results
      stats: a.attributeStats
        .filter((s) => !s.suppressed)
        .map((s) => ({
          attribute: s.attribute,
          valueA: s.valueA,
          valueB: s.valueB,
          valueALabel: s.valueALabel,
          valueBLabel: s.valueBLabel,
          rateA: s.rateA,
          n: s.n,
        })),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}

export const GET = withTiming("crowd", getHandler);
