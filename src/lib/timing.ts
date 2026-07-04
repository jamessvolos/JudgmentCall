// Lightweight route timing (PERF-WAVES §3). Wraps an API handler to emit a
// structured server log line and a Server-Timing response header, so p95s are
// readable from Vercel logs and browser devtools before/after each perf wave.
// Server-side only; logs carry a route name + duration + status — never any
// vote content, so it's blinding-neutral.

type Handler = (request: Request) => Promise<Response>;

export function withTiming(name: string, handler: Handler): Handler {
  return async (request: Request) => {
    const start = performance.now();
    try {
      const res = await handler(request);
      const ms = Math.round(performance.now() - start);
      // One structured line per request; grep `[perf]` in logs for a p95.
      console.log(`[perf] route=${name} ms=${ms} status=${res.status}`);
      try {
        res.headers.set("Server-Timing", `app;dur=${ms};desc="${name}"`);
      } catch {
        // Some responses have immutable headers; the log line is enough.
      }
      return res;
    } catch (e) {
      const ms = Math.round(performance.now() - start);
      console.log(`[perf] route=${name} ms=${ms} status=500 error`);
      throw e;
    }
  };
}
