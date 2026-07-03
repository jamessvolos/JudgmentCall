"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionId } from "@/lib/session-client";

const FIELDS = [
  { name: "deckName", label: "Deck name", ph: "Q3 board pack" },
  { name: "title", label: "Finding title", ph: "Churn fell after the pricing change" },
  { name: "contextSnippet", label: "The data (one stat or 1–3 rows)", ph: "**Churn, Q3:** 2.1% (Q2: 3.4%) · Pricing change shipped July 1" },
  { name: "sourceLabel", label: "Source label", ph: "Internal retention dashboard" },
  { name: "fact", label: "Truth: the fact (with exact figures)", ph: "Monthly churn fell from 3.4% in Q2 to 2.1% in Q3." },
  { name: "driver", label: "Truth: the driver (what moved it)", ph: "The decline followed the July 1 pricing change." },
  { name: "limitation", label: "Truth: the limitation (what it can't claim)", ph: "One quarter of data; the pricing change is correlational, not proven causal." },
] as const;

export default function SubmitPage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({ domain: "ops" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), ...values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "submit failed");
      router.push(`/d/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "submit failed");
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <form onSubmit={submit} className="mx-auto w-full max-w-xl space-y-4">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent">
          Judgment Call · Bring your own data
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Run this on your numbers</h1>
        <p className="text-sm text-muted">
          Submit one finding and get a private deck: six tellings of your fact, reviewed before
          anyone votes, scoped to a link only you share. Your deck&apos;s votes never enter the
          public study. You own the truth claim — write it in three sentences below.
        </p>
        {FIELDS.map((f) => (
          <label key={f.name} className="block text-sm">
            <span className="font-semibold">{f.label}</span>
            <textarea
              required
              minLength={3}
              rows={f.name === "contextSnippet" ? 2 : 1}
              placeholder={f.ph}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-card-border bg-card px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </label>
        ))}
        <label className="block text-sm">
          <span className="font-semibold">Domain</span>
          <select
            value={values.domain}
            onChange={(e) => setValues((v) => ({ ...v, domain: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-card-border bg-card px-3 py-2 text-sm"
          >
            {["earnings", "econ", "sports", "ops"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent disabled:opacity-60"
        >
          {busy ? "Creating deck…" : "Create my private deck"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">
          Don&apos;t submit confidential or personal data — anyone with the deck link can read it.
        </p>
      </form>
    </main>
  );
}
