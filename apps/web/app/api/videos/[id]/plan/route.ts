import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { brandKitSchema, giftAssetKeysFixture, validateVideoPlan } from "@shortfactory/contracts";
import { brands, createVideoRepository, videos, workspaces } from "@shortfactory/db";
import { getDb } from "../../../../../lib/db";
import { getRequestSession } from "../../../../../lib/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;

  let input: { version?: unknown; plan?: unknown };
  try {
    input = await request.json() as { version?: unknown; plan?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Number.isInteger(input.version) || typeof input.plan !== "object" || input.plan === null) {
    return NextResponse.json({ error: "version_and_plan_required" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db.select({ video: videos, brand: brands }).from(videos)
      .innerJoin(brands, eq(videos.brandId, brands.id))
      .innerJoin(workspaces, eq(videos.workspaceId, workspaces.id))
      .where(and(eq(videos.id, id), eq(workspaces.ownerUserId, session.subject)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "video_not_found" }, { status: 404 });
    if (row.video.version !== input.version) return NextResponse.json({ error: "version_conflict", currentVersion: row.video.version }, { status: 409 });

    const brand = brandKitSchema.parse(row.brand.kitJson);
    const result = validateVideoPlan(input.plan, { brand, availableAssetKeys: new Set(giftAssetKeysFixture) });
    if (!result.ok) return NextResponse.json({ error: "invalid_plan", issues: result.issues }, { status: 400 });
    const plan = { ...result.plan, brandId: row.brand.id };
    const video = await createVideoRepository(db).updatePlan(id, row.video.version, plan);
    if (!video) return NextResponse.json({ error: "version_conflict" }, { status: 409 });
    return NextResponse.json({ video, plan });
  } catch (error) {
    console.error("plan update failed", error);
    return NextResponse.json({ error: "plan_update_failed" }, { status: 400 });
  }
}
