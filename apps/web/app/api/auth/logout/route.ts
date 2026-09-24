import { NextResponse } from "next/server";
import { sessionCookie } from "@shortfactory/auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie("", 0, process.env.NODE_ENV === "production"));
  return response;
}
