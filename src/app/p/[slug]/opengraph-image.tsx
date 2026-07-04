import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OgMasthead, ogFonts } from "@/lib/og";
import { personaTitle } from "@/components/TastePoster";
import { levelFor } from "@/lib/progression";
import { computePersonalResults } from "@/lib/results";
import { getSessionByPublicSlug } from "@/lib/repo";

// The poster's social twin: pixel-perfect PNG for link unfurls. Craft-only
// data, same as the page.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A Judgment Call insight-taste profile";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionByPublicSlug(slug);
  const results = session ? await computePersonalResults(session.id) : null;
  const title = results ? personaTitle(results.preferences) : "The Undecided (so far)";
  const solid = (results?.preferences ?? []).filter((p) => !p.hedged).slice(0, 3);
  const level = session ? levelFor(session.xp) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: OG.bg,
          padding: "64px 72px",
          fontFamily: "Plex Mono",
        }}
      >
        <OgMasthead />
        <div
          style={{
            marginTop: 48,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.22em",
            color: OG.acc,
            display: "flex",
          }}
        >
          MY INSIGHT TASTE
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 68,
            fontWeight: 600,
            lineHeight: 1.1,
            color: OG.fg,
            display: "flex",
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 14, fontSize: 22, color: OG.mut, display: "flex" }}>
          {`${results?.voteCount ?? 0} judgment calls${level ? ` · ${level.title.toUpperCase()}` : ""}`}
        </div>
        <div style={{ flex: 1, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
          {solid.map((p) => (
            <div key={p.attribute} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: OG.fg }}>
                  {p.valueLabel}
                </span>
                <span style={{ fontSize: 18, color: OG.mut }}>
                  {p.picked}/{p.shown}
                </span>
              </div>
              <div style={{ width: "100%", height: 4, background: OG.rule, display: "flex" }}>
                <div
                  style={{
                    width: `${(p.picked / p.shown) * 100}%`,
                    height: 4,
                    background: OG.acc,
                    display: "flex",
                  }}
                />
              </div>
            </div>
          ))}
          {solid.length === 0 && (
            <div style={{ fontSize: 22, color: OG.mut, display: "flex" }}>
              A profile is still forming — what&apos;s your insight taste?
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: await ogFonts(),
      // A published poster is immutable per slug — cache it hard (perf wave 5).
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}
