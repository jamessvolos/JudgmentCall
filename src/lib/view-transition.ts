// Same-document View Transition wrapper: progressive enhancement only.
// Unsupported browsers (and reduced-motion users) get the plain state update —
// today's instant swap plus whatever CSS entrance the new content carries.

import { flushSync } from "react-dom";

export function withViewTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
