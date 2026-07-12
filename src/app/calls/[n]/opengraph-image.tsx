import { ImageResponse } from "next/og";
import { computeAnalyticsCached, MIN_N } from "@/lib/analytics";
import { HOUSE_VIEW } from "@/lib/house-view";
import { deskVerdict, verdictChipLabel } from "@/lib/desk-verdict";
import { ATTRIBUTE_LABELS, VALUE_LABELS } from "@/lib/types";
import { OG, OG_SIZE, OgMasthead, ogFonts } from "@/lib/og";

// The per-call share card: one preregistered desk call with the room's live
// verdict — the docket row made social. Same craft-only numbers as the page.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Judgment Call — one desk call, graded live by the room.";

const DANGER = "#f27676"; // hex twin of --danger for the OVERRULES chip

export default async function Image({ params }: { params: Promise<{ n: string }> }) {
  const { n: raw } = await params;
  const n = Number(raw);
  const h = Number.isInteger(n) && n >= 1 && n <= HOUSE_VIEW.length ? HOUSE_VIEW[n - 1] : null;
  if (!h) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", background: OG.bg, display: "flex" }} />
      ),
      { ...size }
    );
  }

  const a = await computeAnalyticsCached();
  const stat = a.attributeStats.find(
    (s) => s.attribute === h.attribute && s.valueA === h.valueA && s.valueB === h.valueB
  );
  const verdict = deskVerdict(stat, h);
  const counted = stat?.n ?? 0;
  const chipColor =
    verdict === "ROOM CONCURS" ? OG.acc : verdict === "ROOM OVERRULES" ? DANGER : OG.mut;

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
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "0.22em",
              color: OG.mut,
              display: "flex",
            }}
          >
            {`DESK CALL R·${n} OF ${HOUSE_VIEW.length} · REG ${h.registered}`}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "0.22em",
              color: OG.acc,
              display: "flex",
            }}
          >
            GRADED LIVE
          </div>
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 22,
            letterSpacing: "0.18em",
            color: OG.mut,
            display: "flex",
          }}
        >
          {(ATTRIBUTE_LABELS[h.attribute] ?? h.attribute).toUpperCase()}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 54,
            fontWeight: 600,
            lineHeight: 1.15,
            color: OG.fg,
            display: "flex",
          }}
        >
          {`${VALUE_LABELS[h.valueA] ?? h.valueA} vs ${VALUE_LABELS[h.valueB] ?? h.valueB}`}
        </div>
        <div style={{ marginTop: 22, fontSize: 26, color: OG.fg, display: "flex" }}>
          {`THE DESK PICKS: ${(VALUE_LABELS[h.pick] ?? h.pick).toUpperCase()}`}
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 27,
            lineHeight: 1.4,
            color: OG.mut,
            display: "flex",
          }}
        >
          {`“${h.line}”`}
        </div>

        <div style={{ flex: 1, display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              border: `3px solid ${chipColor}`,
              color: chipColor,
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "0.14em",
            }}
          >
            {`THE ROOM: ${verdictChipLabel(verdict)}`}
          </div>
          <div style={{ fontSize: 24, color: OG.mut, display: "flex" }}>
            {verdict === "JURY'S OUT"
              ? `still collecting — ${counted}/${MIN_N} counted votes`
              : `n=${counted} · Wilson 95%`}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: await ogFonts(),
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    }
  );
}
