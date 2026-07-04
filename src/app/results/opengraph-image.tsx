import { ImageResponse } from "next/og";
import { computeAnalyticsCached } from "@/lib/analytics";
import { OG, OG_SIZE, OgMasthead, ogFonts } from "@/lib/og";

// Live social card for the public results page: headline totals plus the
// strongest published contrast, drawn in the caliper grammar. Faithful-only
// public statistics — the same numbers as the page itself.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Judgment Call — live results: what makes an insight land?";

export default async function Image() {
  const a = await computeAnalyticsCached();
  const top = a.attributeStats.find((s) => !s.suppressed && s.rateA !== null);

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
            marginTop: 52,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.22em",
            color: OG.acc,
            display: "flex",
          }}
        >
          LIVE RESULTS
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.15,
            color: OG.fg,
            display: "flex",
          }}
        >
          What makes an insight land?
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 26,
            color: OG.mut,
            display: "flex",
          }}
        >
          {`${a.totals.countedVotes.toLocaleString("en-US")} counted votes · ${a.totals.votingSessions.toLocaleString("en-US")} sessions · Wilson 95% intervals · 30+ votes to publish`}
        </div>
        <div style={{ flex: 1, display: "flex" }} />
        {top ? (
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <div style={{ fontSize: 26, color: OG.fg, display: "flex", fontWeight: 600 }}>
              {`${top.valueALabel} vs ${top.valueBLabel}`}
            </div>
            {/* Caliper: track, 50% null line, interval bracket, point. */}
            <div
              style={{
                marginTop: 22,
                position: "relative",
                width: "100%",
                height: 36,
                display: "flex",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 17,
                  height: 2,
                  background: OG.rule,
                  display: "flex",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 4,
                  width: 2,
                  height: 28,
                  background: OG.mut,
                  display: "flex",
                }}
              />
              {top.interval && (
                <div
                  style={{
                    position: "absolute",
                    left: `${top.interval.lo * 100}%`,
                    width: `${Math.max(1, (top.interval.hi - top.interval.lo) * 100)}%`,
                    top: 8,
                    height: 12,
                    borderLeft: `4px solid ${OG.acc}`,
                    borderRight: `4px solid ${OG.acc}`,
                    borderTop: `4px solid ${OG.acc}`,
                    display: "flex",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  left: `${top.rateA! * 100}%`,
                  top: 11,
                  width: 14,
                  height: 14,
                  marginLeft: -7,
                  borderRadius: 7,
                  background: OG.acc,
                  display: "flex",
                }}
              />
            </div>
            <div style={{ marginTop: 14, fontSize: 22, color: OG.mut, display: "flex" }}>
              {`${top.valueALabel} wins ${Math.round(top.rateA! * 100)}% (n=${top.n})`}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 24, color: OG.mut, display: "flex" }}>
            Every contrast is still collecting — 30+ votes before a rate is shown.
          </div>
        )}
      </div>
    ),
    { ...size, fonts: await ogFonts() }
  );
}
