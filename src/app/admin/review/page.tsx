import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ATTRIBUTE_KEYS } from "@/lib/types";
import { audit, isAdmin } from "@/lib/admin-auth";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";

// The M2 human review gate (spec §4): generated variants arrive as
// status=pending and are served to voters only after explicit approval here.
// This screen IS the governance thesis — a human defines the standard before
// automation ships it.
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!(await isAdmin(key))) notFound();

  async function decide(formData: FormData) {
    "use server";
    if (!(await isAdmin(String(formData.get("key") ?? "") || undefined))) return;
    const id = String(formData.get("id"));
    const decision = String(formData.get("decision"));
    const reason = String(formData.get("reason") ?? "").slice(0, 300) || undefined;
    if (decision !== "approved" && decision !== "rejected") return;
    await prisma.variant.update({ where: { id }, data: { status: decision } });
    // Rejection reasons feed the generation prompt as negative exemplars
    // (recursive learning) — via the audit log, so the loop stays inspectable.
    await audit(`variant.${decision === "approved" ? "approve" : "reject"}`, id, reason);
    revalidatePath("/admin/review");
  }

  // Bulk clear for one finding: same review standard, one click after the
  // read-through. Rejects still go one at a time — a rejection needs a reason
  // (it feeds generation), so it can never be bulk.
  async function approveFinding(formData: FormData) {
    "use server";
    if (!(await isAdmin(String(formData.get("key") ?? "") || undefined))) return;
    const findingId = String(formData.get("findingId"));
    const ids = await prisma.variant.findMany({
      where: { findingId, status: "pending" },
      select: { id: true },
    });
    for (const { id } of ids) {
      await prisma.variant.update({ where: { id }, data: { status: "approved" } });
      await audit("variant.approve", id, "bulk: finding approved after read-through");
    }
    revalidatePath("/admin/review");
  }

  const pending = await prisma.variant.findMany({
    where: { status: "pending" },
    include: { finding: true },
    orderBy: [{ findingId: "asc" }, { id: "asc" }],
  });
  // One truth panel per finding, variants judged against it in place.
  const groups = new Map<string, { finding: (typeof pending)[number]["finding"]; variants: typeof pending }>();
  for (const v of pending) {
    const g = groups.get(v.findingId) ?? { finding: v.finding, variants: [] as typeof pending };
    g.variants.push(v);
    groups.set(v.findingId, g);
  }

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <AdminNav active="/admin/review" />
        <h1 className="font-serif font-semibold text-ink-strong text-3xl tracking-tight">Review generated variants</h1>
        <p className="mt-2 text-sm text-muted">
          {pending.length} pending. Check text against the truth summary (claims ledger below
          each variant), verify tags against docs/ATTRIBUTES.md, then approve or reject.
          Only approved variants are ever served to voters.
        </p>

        <div className="mt-6 space-y-8">
          {[...groups.values()].map(({ finding, variants }) => (
            <section key={finding.id}>
              {/* The truth panel: read once, judge everything below against it. */}
              <div className="rounded-card border-l-[3px] border-rule-strong bg-wash px-4 py-3">
                <p className="text-sm font-semibold">{finding.title}</p>
                <p className="mt-1 text-sm leading-relaxed">{finding.truthSummary}</p>
                <p className="mt-1.5 font-mono text-xs text-muted">
                  {finding.sourceLabel}
                  {finding.sourceUrl && (
                    <>
                      {" · "}
                      <a href={finding.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                        source
                      </a>
                    </>
                  )}
                  {" · "}
                  {variants.length} pending
                </p>
              </div>
              <div className="mt-3 space-y-3">
                {variants.map((v) => {
            const selfCheck = v.selfCheck ? JSON.parse(v.selfCheck) : null;
            return (
              <div key={v.id} className="rounded-card border border-card-border bg-card p-5">
                <p className="text-[15px] leading-relaxed">{v.text}</p>
                <p className="mt-2 text-xs font-mono text-muted">
                  {ATTRIBUTE_KEYS.map((k) => `${k}=${v[k]}`).join("  ")}
                </p>
                {selfCheck && (
                  <details className="mt-2 text-xs text-muted">
                    <summary className="cursor-pointer font-semibold">
                      Claims ledger ({selfCheck.claims?.length ?? 0}) · entailment:{" "}
                      {selfCheck.entailment}
                      {selfCheck.lints?.length > 0 && ` · ${selfCheck.lints.length} lints`}
                    </summary>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {selfCheck.claims?.map(
                        (c: { claim: string; support: string }, i: number) => (
                          <li key={i}>
                            {c.claim} — <em>{c.support}</em>
                          </li>
                        )
                      )}
                      {selfCheck.lints?.map((l: string, i: number) => (
                        <li key={`lint-${i}`} className="text-amber-600">
                          LINT: {l}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(["approved", "rejected"] as const).map((decision) => (
                    <form key={decision} action={decide} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="key" value={key} />
                      <input type="hidden" name="decision" value={decision} />
                      {decision === "rejected" && (
                        <input
                          name="reason"
                          placeholder="why? (feeds generation)"
                          className="rounded-lg border border-card-border bg-background px-2 py-1.5 text-xs w-44"
                        />
                      )}
                      <button
                        className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${
                          decision === "approved"
                            ? "bg-accent text-on-accent"
                            : "border border-card-border text-muted hover:text-foreground"
                        }`}
                      >
                        {decision === "approved" ? "Approve" : "Reject"}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            );
                })}
              </div>
              <form action={approveFinding} className="mt-3">
                <input type="hidden" name="findingId" value={finding.id} />
                <input type="hidden" name="key" value={key} />
                <button className="w-full rounded-card border border-card-border bg-card px-4 py-2.5 font-mono text-sm font-semibold text-foreground transition hover:border-rule-strong">
                  Approve all {variants.length} above — read them first
                </button>
              </form>
            </section>
          ))}
          {pending.length === 0 && (
            <p className="text-sm text-muted">
              Nothing pending. Run <code>npx tsx scripts/generate.ts findings.json</code> to
              generate more.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
