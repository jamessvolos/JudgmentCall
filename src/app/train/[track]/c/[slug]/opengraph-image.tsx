import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OgMasthead, ogFonts } from "@/lib/og";
import { getSessionByPublicSlug, getQuizStanding } from "@/lib/repo";
import { getTrack, isTrackId } from "@/lib/train-tracks";
import { credentialView } from "@/lib/credential";

// The credential's social twin: the calibration score, a reliability curve, and
// the honesty badges as a PNG for link unfurls. Same craft-only folds as the
// page.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A Judgment Call calibration credential — is your confidence honest?";

export default async function Image({ params }: { params: Promise<{ track: string; slug: string }> }) {
  const { track, slug } = await params;
  const t = isTrackId(track) ? getTrack(track) : null;
  const session = t ? await getSessionByPublicSlug(slug) : null;
  const standing = session && t ? await getQuizStanding(session.id, track) : null;
  if (!t || !standing || standing.count === 0) {
    return new ImageResponse(
      (<div style={{ width: "100%", height: "100%", background: OG.bg, display: "flex" }} />),
      { ...size }
    );
  }
  const v = credentialView(standing, t);

  // reliability plot geometry (points arrive normalized [0,1]×[0,1])
  const PW = 380, PH = 300, ppad = 34;
  const gx = (x: number) => ppad + x * (PW - 2 * ppad);
  const gy = (y: number) => PH - ppad - y * (PH - 2 * ppad);
  const pts = [...v.points].sort((a, b) => a.x - b.x);
  const poly = pts.map((p) => `${gx(p.x)},${gy(p.y)}`).join(" ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: OG.bg,
          padding: "56px 72px 60px",
          fontFamily: "Plex Mono",
        }}
      >
        <OgMasthead />
        <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", width: "100%" }}>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.22em", color: OG.acc, display: "flex" }}>
            CALIBRATION CREDENTIAL
          </span>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.2em", color: OG.mut, display: "flex" }}>
            {v.room}
          </span>
        </div>

        <div style={{ marginTop: 30, display: "flex", flex: 1, width: "100%", gap: 48 }}>
          {/* left: the number + verdict */}
          <div style={{ display: "flex", flexDirection: "column", width: 440 }}>
            {v.score != null ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline" }}>
                  <span style={{ fontSize: 150, fontWeight: 600, lineHeight: 1, color: OG.acc, display: "flex" }}>{v.score}</span>
                  <span style={{ fontSize: 40, color: OG.mut, display: "flex", marginLeft: 8 }}>/100</span>
                </div>
                <span style={{ marginTop: 8, fontSize: 22, letterSpacing: "0.16em", color: OG.fg, display: "flex" }}>CALIBRATION SCORE</span>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline" }}>
                  <span style={{ fontSize: 96, fontWeight: 600, lineHeight: 1, color: OG.fg, display: "flex" }}>{v.provisional}</span>
                  <span style={{ fontSize: 34, color: OG.mut, display: "flex", marginLeft: 8 }}>/30</span>
                </div>
                <span style={{ marginTop: 8, fontSize: 21, letterSpacing: "0.14em", color: OG.mut, display: "flex" }}>STAKED TOWARD A SCORE</span>
              </>
            )}
            <span style={{ marginTop: 20, fontSize: 24, lineHeight: 1.35, color: OG.mut, display: "flex" }}>{v.tendencyLine}</span>
            <div style={{ flex: 1, minHeight: 24, display: "flex" }} />
            <span style={{ fontSize: 23, color: OG.fg, display: "flex" }}>
              {`LEVEL ${v.levelRoman} · ${v.levelTitle.toUpperCase()} · ${v.rating}`}
            </span>
            <span style={{ marginTop: 8, fontSize: 20, color: OG.mut, display: "flex" }}>
              {`accuracy ${v.accuracyPct}% · avg conviction ${v.meanConfPct}% · ${v.staked} staked`}
            </span>
          </div>

          {/* right: reliability curve. Satori has no <text> node — axis labels
              are positioned divs over the plot; only the geometry is SVG. */}
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", display: "flex", width: PW, height: PH }}>
              <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
                <line x1={ppad} y1={PH - ppad} x2={PW - ppad} y2={PH - ppad} stroke={OG.rule} strokeWidth={1.5} />
                <line x1={ppad} y1={ppad} x2={ppad} y2={PH - ppad} stroke={OG.rule} strokeWidth={1.5} />
                <line x1={gx(0)} y1={gy(0.25)} x2={gx(1)} y2={gy(1)} stroke={OG.rule} strokeDasharray="5 5" strokeWidth={1.5} />
                {pts.length > 1 && <polyline points={poly} fill="none" stroke={OG.acc} strokeWidth={3} />}
                {pts.map((p, i) => (
                  <circle key={i} cx={gx(p.x)} cy={gy(p.y)} r={Math.min(10, 5 + p.weight)} fill={OG.acc} />
                ))}
              </svg>
              <div style={{ position: "absolute", left: ppad, top: PH - 22, fontSize: 15, color: OG.mut, display: "flex" }}>25%</div>
              <div style={{ position: "absolute", right: ppad - 6, top: PH - 22, fontSize: 15, color: OG.mut, display: "flex" }}>99%</div>
              <div style={{ position: "absolute", left: 2, top: ppad - 10, fontSize: 15, color: OG.mut, display: "flex" }}>100%</div>
            </div>
          </div>
        </div>

        {/* badges footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
          {v.badges.length > 0 ? (
            v.badges.slice(0, 3).map((b) => (
              <div key={b.code} style={{ display: "flex", border: `2px solid ${OG.acc}`, color: OG.acc, borderRadius: 6, padding: "6px 14px", fontSize: 18, fontWeight: 600, letterSpacing: "0.1em" }}>
                {b.name}
              </div>
            ))
          ) : (
            <span style={{ fontSize: 20, color: OG.mut, display: "flex" }}>How honest is your confidence? judgment-call.vercel.app/train</span>
          )}
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
