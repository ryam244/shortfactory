import { NextResponse } from "next/server";
import { createSessionToken, normalizeEmail, sessionCookie, verifyPassword } from "@shortfactory/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const adminEmail = process.env.SHORTFACTORY_ADMIN_EMAIL;
  const passwordHash = process.env.SHORTFACTORY_ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.SHORTFACTORY_SESSION_SECRET;
  if (!adminEmail || !passwordHash || !sessionSecret) {
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

  const emailMatches = normalizeEmail(input.email) === normalizeEmail(adminEmail);
  const passwordMatches = await verifyPassword(input.password, passwordHash);
  if (!emailMatches || !passwordMatches) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(createSessionToken(adminEmail, sessionSecret)));
  return response;
}
