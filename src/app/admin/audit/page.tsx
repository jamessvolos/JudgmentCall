import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!(await isAdmin(key))) notFound();
  const events = await prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <AdminNav active="/admin/audit" />
        <h1 className="text-3xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted">
          The study&apos;s paper trail — every consequential admin action, newest first.
        </p>
        <div className="mt-4 space-y-1.5 text-sm font-mono">
          {events.map((e) => (
            <p key={e.id} className="rounded-lg border border-card-border bg-card px-3 py-2">
              <span className="text-muted">{e.createdAt.toISOString().slice(0, 16)}</span>{" "}
              <strong>{e.action}</strong> {e.subject.slice(0, 12)}
              {e.detail && <span className="text-muted"> — {e.detail}</span>}
            </p>
          ))}
          {events.length === 0 && <p className="text-muted">No events yet.</p>}
        </div>
      </div>
    </main>
  );
}
