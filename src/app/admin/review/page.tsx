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

  const pending = await prisma.variant.findMany({
    where: { status: "pending" },
    include: { finding: true },
    orderBy: [{ findingId: "asc" }, { id: "asc" }],
  });

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <AdminNav active="/admin/review" />
        <h1 className="text-3xl font-bold tracking-tight">Review generated variants</h1>
        <p className="mt-2 text-sm text-muted">
          {pending.length} pending. Check text against the truth summary (claims ledger below
          each variant), verify tags against docs/ATTRIBUTES.md, then approve or reject.
          Only approved variants are ever served to voters.
        </p>

        <div className="mt-6 space-y-4">
          {pending.map((v) => {
            const selfCheck = v.selfCheck ? JSON.parse(v.selfCheck) : null;
            return (
              <div key={v.id} className="rounded-2xl border border-card-border bg-card p-5">
                <p className="text-xs text-muted">
                  {v.finding.title} · truth: {v.finding.truthSummary}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed">{v.text}</p>
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
