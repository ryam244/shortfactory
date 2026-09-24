import { NextResponse } from "next/server";
import { createSessionToken, normalizeEmail, sessionCookie, verifyPassword } from "@shortfactory/auth";
import { getIdentityRepository } from "../../../../lib/db";
import { authenticateUser } from "../../../../src/authenticate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sessionSecret = process.env.SHORTFACTORY_SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  let input: { email?: unknown; password?: unknown };
  try {
    input = await request.json() as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return NextResponse.json({ error: "email_and_password_required" }, { status: 400 });
  }

  let subject: string;
  if (process.env.DATABASE_URL) {
    try {
      const user = await authenticateUser({ email: input.email, password: input.password }, getIdentityRepository());
      if (!user) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
      subject = user.id;
    } catch (error) {
      console.error("database authentication failed", error);
      return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
    }
  } else {
    const adminEmail = process.env.SHORTFACTORY_ADMIN_EMAIL;
    const passwordHash = process.env.SHORTFACTORY_ADMIN_PASSWORD_HASH;
    if (!adminEmail || !passwordHash) return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
    const emailMatches = normalizeEmail(input.email) === normalizeEmail(adminEmail);
    const passwordMatches = await verifyPassword(input.password, passwordHash);
    if (!emailMatches || !passwordMatches) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    subject = normalizeEmail(adminEmail);
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(createSessionToken(subject, sessionSecret), undefined, process.env.NODE_ENV === "production"));
  return response;
}
