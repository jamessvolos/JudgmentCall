import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Blinding contract: teaching.ts carries the overclaim drill's answer-key
  // vocabulary, which must never leak toward a public-surface bundle (see
  // scripts/bundle-guard.sh — this rule is the same contract at lint time).
  // Only the drill world may import it.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/teaching", "**/lib/teaching", "./teaching", "../teaching"],
              message:
                "teaching.ts holds drill answer-key vocabulary (blinding contract): import it only from src/app/drill/**, src/app/api/drill/**, or src/lib/drill-credentials*/drill-exam/repo.",
            },
          ],
        },
      ],
    },
  },
  {
    // The drill world — the only legitimate importers of teaching.ts.
    files: [
      "src/app/drill/**",
      "src/app/api/drill/**",
      "src/lib/drill-credentials*",
      "src/lib/drill-exam.ts",
      "src/lib/repo.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
