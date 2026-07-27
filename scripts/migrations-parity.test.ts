// Parity lock between the canonical schema and the PRODUCTION migrations.
//
// Local dev applies prisma/migrations (sqlite); production applies
// prisma/postgres/migrations against Neon. A column added only to the sqlite
// side ships a Prisma client that selects a column the production table does
// not have — every query on that model 500s while local dev stays green
// (exactly how QuizAttempt.level broke all five training rooms). This test
// fails the suite the moment the schema declares a scalar field that no
// postgres migration ever creates.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const schema = readFileSync("prisma/schema.prisma", "utf8");

const migrationsDir = "prisma/postgres/migrations";
const sql = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => readFileSync(join(migrationsDir, e.name, "migration.sql"), "utf8"))
  .join("\n");

// Model names, so relation-typed fields (no column of their own) can be skipped.
const modelNames = new Set([...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]));

const SCALARS = new Set(["String", "Int", "Float", "Boolean", "DateTime", "BigInt", "Decimal", "Bytes", "Json"]);

// Per-table SQL scope: ONLY the CREATE TABLE "Model" block and ALTER TABLE
// "Model" statements. Matching a field name against ALL migration SQL
// concatenated let a common column name (status, id, track…) on some OTHER
// table false-pass a brand-new model that has no migration at all.
function tableScopedSql(model: string): string {
  const create = sql.match(new RegExp(`CREATE TABLE (?:"public"\\.)?"${model}"\\s*\\([^;]*;`, "g")) ?? [];
  const alter = sql.match(new RegExp(`ALTER TABLE (?:"public"\\.)?"${model}"[^;]*;`, "g")) ?? [];
  return [...create, ...alter].join("\n");
}

for (const model of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  const [, name, body] = model;
  const scoped = tableScopedSql(name);
  for (const line of body.split("\n")) {
    const m = line.trim().match(/^(\w+)\s+(\w+)(\[\])?\??\s*/);
    if (!m) continue;
    const [, field, type] = m;
    if (modelNames.has(type)) continue; // relation field — no column
    if (!SCALARS.has(type)) continue; // block attributes, enums, comments
    check(
      `${name}.${field} exists in postgres migrations`,
      new RegExp(`"${field}"`).test(scoped),
      `no postgres CREATE/ALTER TABLE "${name}" creates column "${field}" — add one under ${migrationsDir}`
    );
  }
}

// Drift lock for the committed build product: prisma/postgres/schema.prisma is
// derived from the canonical sqlite schema by scripts/gen-postgres-schema.sh
// (the same script vercel-build.sh and the workflows run), but it is committed
// — so it can go stale when the canonical schema changes. Re-derive it here and
// require a byte-for-byte match.
{
  const tmp = mkdtempSync(join(tmpdir(), "pg-schema-"));
  const derived = join(tmp, "schema.prisma");
  try {
    execFileSync("bash", ["scripts/gen-postgres-schema.sh", derived]);
    check(
      "prisma/postgres/schema.prisma matches the derived postgres schema",
      readFileSync(derived, "utf8") === readFileSync("prisma/postgres/schema.prisma", "utf8"),
      "stale build product — regenerate with: bash scripts/gen-postgres-schema.sh  (writes prisma/postgres/schema.prisma)"
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (failures > 0) {
  console.error(`\n  (${failures} column(s) missing from production migrations)`);
  process.exit(1);
}
console.log("\n  (schema ↔ postgres-migrations parity · ALL PASS)");
