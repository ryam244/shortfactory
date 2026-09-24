import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@shortfactory/auth";

export const runtime = "nodejs";

export async function GET() {
  const secret = process.env.SHORTFACTORY_SESSION_SECRET;
  const token = (await cookies()).get("sf_session")?.value;
  const session = secret && token ? verifySessionToken(token, secret) : null;
  return NextResponse.json(session ? { authenticated: true, subject: session.subject } : { authenticated: false });
}
