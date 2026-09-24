import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getRequestSession } from "../../../lib/session";
import { brands, workspaces, createVideoRepository } from "@shortfactory/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let input: { workspaceId?: unknown; brandId?: unknown; topic?: unknown };
  try {
    input = await request.json() as { workspaceId?: unknown; brandId?: unknown; topic?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof input.workspaceId !== "string" || typeof input.brandId !== "string" || typeof input.topic !== "string" || !input.topic.trim()) {
    return NextResponse.json({ error: "workspace_id_brand_id_and_topic_required" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [ownedBrand] = await db.select({ brandId: brands.id }).from(brands)
      .innerJoin(workspaces, eq(brands.workspaceId, workspaces.id))
      .where(and(eq(brands.id, input.brandId), eq(brands.workspaceId, input.workspaceId), eq(workspaces.ownerUserId, session.subject)))
      .limit(1);
    if (!ownedBrand) return NextResponse.json({ error: "brand_forbidden" }, { status: 403 });
    const video = await createVideoRepository(db).create({ workspaceId: input.workspaceId, brandId: input.brandId, topic: input.topic });
    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error("video creation failed", error);
    return NextResponse.json({ error: "video_creation_failed" }, { status: 400 });
  }
}
