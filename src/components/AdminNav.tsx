import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/review", label: "Review" },
  { href: "/admin/audit", label: "Audit" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="mb-6 flex gap-2 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-full px-4 py-1.5 font-semibold ${
            active === t.href
              ? "bg-accent text-on-accent"
              : "border border-card-border text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
