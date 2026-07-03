// Client-side anonymous identity: a UUID in localStorage, sent with every
// request. No auth by design (spec §7).

const KEY = "jc_session_id";

export function getOrCreateSessionId(): string {
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function getSessionId(): string | null {
  return window.localStorage.getItem(KEY);
}

/**
 * Monotonic clock for measuring pair-render → tap latency. Only ever called
 * from event handlers / post-fetch effects (never during render), which the
 * react-hooks purity lint can't infer through a direct performance.now() call.
 */
export function nowMs(): number {
  return performance.now();
}
