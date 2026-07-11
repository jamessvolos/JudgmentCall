// Display metadata for The Record — pure data, no imports, safe for the drill
// client chunk (the fold logic lives in drill-credentials.ts, which is
// server-only because it derives field serves from the crypto salt). Drill-only
// vocabulary: this module may be imported ONLY by drill-credentials.ts and the
// /drill client.

export type GradeMeta = {
  n: 1 | 2 | 3 | 4 | 5;
  roman: string;
  title: string; // fidelity-neutral English — the only strings allowed off /drill
  floor: number | null;
  gate: string; // fine print, drill-only
};

export const GRADE_META: GradeMeta[] = [
  { n: 1, roman: "I", title: "Reader", floor: null, gate: "Walk in. Everyone holds it." },
  {
    n: 2,
    roman: "II",
    title: "Close Reader",
    floor: 1240,
    gate: "Reading at 1240 · 10 graded calls · a catch in each family",
  },
  {
    n: 3,
    roman: "III",
    title: "Fact-Checker",
    floor: 1340,
    gate: "Reading at 1340 · 25 calls · all ten patterns faced · 5 catches above the easy tier",
  },
  {
    n: 4,
    roman: "IV",
    title: "Line Editor",
    floor: 1420,
    gate: "Reading at 1420 · 40 calls · 5 subtle-tier catches · a mid-tier catch in each family",
  },
  {
    n: 5,
    roman: "V",
    title: "The Spike",
    floor: 1500,
    gate: "Reading at 1500 · 60 calls · subtle-tier catches in six patterns",
  },
];

export type CredentialDef = {
  code: string;
  name: string;
  tier: "competence" | "exploration";
  criterion: string; // printed verbatim on the face
};

export const CREDENTIAL_DEFS: CredentialDef[] = [
  { code: "clean_sweep", name: "CLEAN SWEEP", tier: "competence", criterion: "Eight consecutive calls, all correct." },
  { code: "fine_print", name: "THE FINE PRINT", tier: "competence", criterion: "Ten catches at difficulty 3, across four or more patterns." },
  { code: "fidelity_seal", name: "FIDELITY SEAL", tier: "competence", criterion: "Every fidelity pattern: 4 of 5 straight calls caught, at least one above the easy tier." },
  { code: "craft_seal", name: "CRAFT SEAL", tier: "competence", criterion: "Every craft pattern: 4 of 5 straight calls caught, at least one above the easy tier." },
  { code: "named_caught", name: "NAMED AND CAUGHT", tier: "competence", criterion: "Ten calls caught and named — the full move, both halves." },
  { code: "correction", name: "THE CORRECTION", tier: "competence", criterion: "A pattern that was beating you, beaten: behind on the ledger, then three straight catches." },
  { code: "cold_reader", name: "COLD READER", tier: "competence", criterion: "Ten correct field reads across four or more patterns — no pair to lean on." },
  { code: "clean_hands", name: "CLEAN HANDS", tier: "competence", criterion: "Eight sound tellings correctly cleared in the field — a skeptic, not a crank." },
  { code: "auditor", name: "THE AUDITOR", tier: "competence", criterion: "Five ledgers closed perfectly, two above the easy tier." },
  { code: "rounds", name: "THE ROUNDS", tier: "exploration", criterion: "Faced all ten patterns." },
  { code: "all_benches", name: "ALL BENCHES", tier: "exploration", criterion: "At least one call on every instrument." },
  { code: "deep_end", name: "THE DEEP END", tier: "exploration", criterion: "Took a difficulty-3 call in both families — catching it not required, stepping up is the point." },
];
