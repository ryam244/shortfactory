import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assets, brands, workspaces } from "@shortfactory/db";
import { getDb } from "../../../../../lib/db";
import { getRequestSession } from "../../../../../lib/session";
import { getStorage } from "../../../../../lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const db = getDb();
    const [row] = await db.select({ asset: assets }).from(assets)
      .innerJoin(brands, eq(assets.brandId, brands.id))
      .innerJoin(workspaces, eq(assets.workspaceId, workspaces.id))
      .where(and(eq(assets.id, id), eq(workspaces.ownerUserId, session.subject))).limit(1);
    if (!row) return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
    const bytes = await getStorage().get(row.asset.storageKey);
    return new Response(bytes.buffer as ArrayBuffer, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error("asset content failed", error);
    return NextResponse.json({ error: "asset_unavailable" }, { status: 404 });
  }
}
