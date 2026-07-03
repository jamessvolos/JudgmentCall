// Admin auth (ROADMAP §4): ADMIN_KEY is exchanged once at /admin/login for an
// httpOnly cookie carrying a salted digest — the key never rides in URLs
// (browser history / referrer leak). ?key= is still accepted for curl and
// local scripts.

import { createHash } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

export const ADMIN_COOKIE = "jc_admin";

export function adminDigest(): string | null {
  const key = process.env.ADMIN_KEY;
  if (!key) return null;
  // The checked-in dev key must never unlock a public deployment.
  if (process.env.NODE_ENV === "production" && key === "local-admin") return null;
  return createHash("sha256").update(`jc-admin:${key}`).digest("hex");
}

/** True when the request carries the admin cookie or a valid ?key=. */
export async function isAdmin(searchKey?: string): Promise<boolean> {
  const digest = adminDigest();
  if (!digest) return false; // no ADMIN_KEY configured -> admin surface off
  if (searchKey && searchKey === process.env.ADMIN_KEY) return true;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === digest;
}

/** Append to the study's paper trail. Never throws — auditing must not break the action. */
export async function audit(action: string, subject: string, detail?: string): Promise<void> {
  try {
    await prisma.auditEvent.create({ data: { actor: "admin", action, subject, detail } });
  } catch (e) {
    console.error("audit write failed", e);
  }
}
