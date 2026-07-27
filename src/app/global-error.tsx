"use client";

// Root error boundary. Replaces the entire root layout when it crashes, so it
// must render its own <html>/<body> and cannot rely on globals.css or the
// loaded fonts — everything is inline and system-font.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15161a",
          color: "#f2f3f5",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        }}
      >
        <div style={{ maxWidth: 420, padding: "0 20px", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}
          >
            Judgment Call
          </p>
          <p style={{ margin: "24px 0 0", fontSize: 14, lineHeight: 1.6, color: "#a3a6ae" }}>
            The site hit an error and stopped. A retry usually clears it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 24px",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#f2f3f5",
              background: "transparent",
              border: "1px solid #45484f",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ margin: "24px 0 0", fontSize: 11, color: "#6f727b" }}>
              ref {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
