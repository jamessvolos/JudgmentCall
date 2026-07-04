import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OgMasthead, ogFonts } from "@/lib/og";

// The site's social card: the poster idiom, printed. Static content — the
// live-numbers variant lives at /results/opengraph-image.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt =
  "Judgment Call — two tellings of the same finding. You make the call.";

export default async function Image() {
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
            marginTop: 56,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.22em",
            color: OG.acc,
            display: "flex",
          }}
        >
          A LIVE STUDY OF DATA STORYTELLING
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 76,
            fontWeight: 600,
            lineHeight: 1.12,
            color: OG.fg,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>Two tellings of the</span>
          <span>same finding.</span>
          <span style={{ color: OG.acc }}>You make the call.</span>
        </div>
        <div style={{ flex: 1, display: "flex" }} />
        <div
          style={{
            fontSize: 22,
            color: OG.mut,
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <span>Ten quick calls · your taste profile · no sign-up</span>
          <span>~90 seconds</span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() }
  );
}
