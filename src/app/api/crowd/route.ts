import { NextResponse } from "next/server";
import { computeAnalytics } from "@/lib/analytics";

// Public, unsuppressed crowd win rates — powers "your taste vs the crowd".
export async function GET() {
  const a = await computeAnalytics();
  return NextResponse.json({
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
  });
}
