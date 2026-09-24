import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch (error) {
    console.error("health check failed", error);
    return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
