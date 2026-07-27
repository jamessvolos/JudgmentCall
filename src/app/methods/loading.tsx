// Route loading state: a small centered mono line, matching the client rooms'
// skeletons ("Opening the room…") while the server render is in flight.
export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-5">
      <p className="font-mono text-sm text-muted">Loading…</p>
    </main>
  );
}
