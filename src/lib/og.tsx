// Shared scaffolding for Open Graph images (next/og · satori). The card is
// the poster made social: theme-stable ink tokens, mono voice, double rule.
// Satori can't read woff2, so we load IBM Plex Mono's woff files; the serif
// voice is intentionally absent here — mono caps ARE the masthead voice.

import { readFile } from "fs/promises";
import path from "path";

export const OG_SIZE = { width: 1200, height: 630 };

// Poster tokens (hex equivalents of the OKLCH poster ramp — satori has no
// oklch() support).
// Hex equivalents of the graphite --poster-* OKLCH ramp (satori has no oklch()).
// Keep in step with the tokens in globals.css when the poster palette changes.
export const OG = {
  bg: "#121417",
  fg: "#edf0f4",
  mut: "#9a9fa6",
  rule: "#44484e",
  acc: "#60b0ff",
};

const FONT_DIR = path.join(process.cwd(), "node_modules/@fontsource/ibm-plex-mono/files");

export async function ogFonts() {
  const [regular, semibold] = await Promise.all([
    readFile(path.join(FONT_DIR, "ibm-plex-mono-latin-400-normal.woff")),
    readFile(path.join(FONT_DIR, "ibm-plex-mono-latin-600-normal.woff")),
  ]);
  return [
    { name: "Plex Mono", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Plex Mono", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}

/** Masthead row: hairline — JUDGMENT CALL — hairline, over a double rule. */
export function OgMasthead() {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, width: "100%" }}>
        <div style={{ flex: 1, height: 1, background: OG.rule, display: "flex" }} />
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "0.3em",
            color: OG.fg,
            display: "flex",
          }}
        >
          JUDGMENT CALL
        </div>
        <div style={{ flex: 1, height: 1, background: OG.rule, display: "flex" }} />
      </div>
      <div
        style={{
          marginTop: 14,
          width: "100%",
          borderTop: `3px solid ${OG.rule}`,
          display: "flex",
        }}
      />
      <div
        style={{
          marginTop: 4,
          width: "100%",
          borderTop: `1px solid ${OG.rule}`,
          display: "flex",
        }}
      />
    </div>
  );
}
