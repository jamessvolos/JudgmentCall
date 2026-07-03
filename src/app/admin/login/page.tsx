import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminDigest, audit } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>;
}) {
  const { bad } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const digest = adminDigest();
    if (!digest || String(formData.get("key")) !== process.env.ADMIN_KEY) {
      redirect("/admin/login?bad=1");
    }
    const jar = await cookies();
    jar.set(ADMIN_COOKIE, digest, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
      path: "/admin",
    });
    await audit("admin.login", "console");
    redirect("/admin");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <form action={login} className="w-full max-w-xs space-y-3">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent">
          Judgment Call · Admin
        </p>
        <input
          type="password"
          name="key"
          placeholder="Admin key"
          autoFocus
          className="w-full rounded-card border border-card-border bg-card px-4 py-3 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        />
        <button className="w-full rounded-card bg-accent px-4 py-3 text-sm font-semibold text-on-accent">
          Sign in
        </button>
        {bad && <p className="text-sm text-danger">Wrong key.</p>}
      </form>
    </main>
  );
}
