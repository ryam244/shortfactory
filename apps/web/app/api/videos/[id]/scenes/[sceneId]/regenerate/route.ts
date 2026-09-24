import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { brandKitSchema, giftAssetKeysFixture, validateVideoPlan } from "@shortfactory/contracts";
import { brands, createVideoRepository, videos, workspaces } from "@shortfactory/db";
import { FixtureTextProvider } from "@shortfactory/providers";
import { getDb } from "../../../../../../../lib/db";
import { getRequestSession } from "../../../../../../../lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string; sceneId: string }> }) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, sceneId } = await context.params;
  let input: { version?: unknown };
  try { input = await request.json() as { version?: unknown }; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!Number.isInteger(input.version)) return NextResponse.json({ error: "version_required" }, { status: 400 });

  try {
    const db = getDb();
    const [row] = await db.select({ video: videos, brand: brands }).from(videos)
      .innerJoin(brands, eq(videos.brandId, brands.id))
      .innerJoin(workspaces, eq(videos.workspaceId, workspaces.id))
      .where(and(eq(videos.id, id), eq(workspaces.ownerUserId, session.subject))).limit(1);
    if (!row) return NextResponse.json({ error: "video_not_found" }, { status: 404 });
    if (row.video.version !== input.version) return NextResponse.json({ error: "version_conflict", currentVersion: row.video.version }, { status: 409 });
    if (!row.video.planJson) return NextResponse.json({ error: "plan_required" }, { status: 400 });

    const brand = brandKitSchema.parse(row.brand.kitJson);
    const current = validateVideoPlan(row.video.planJson, { brand, availableAssetKeys: new Set(giftAssetKeysFixture) });
    if (!current.ok) return NextResponse.json({ error: "invalid_plan", issues: current.issues }, { status: 400 });
    const sceneIndex = current.plan.scenes.findIndex((scene) => scene.id === sceneId);
    if (sceneIndex < 0) return NextResponse.json({ error: "scene_not_found" }, { status: 404 });

    const generated = await new FixtureTextProvider().generatePlan({ topic: row.video.topic, brand, availableAssetKeys: new Set(giftAssetKeysFixture) });
    const plan = { ...current.plan, brandId: row.brand.id, scenes: current.plan.scenes.map((scene, index) => index === sceneIndex ? generated.scenes[index] ?? scene : scene) };
    const saved = await createVideoRepository(db).updatePlan(id, row.video.version, plan);
    if (!saved) return NextResponse.json({ error: "version_conflict" }, { status: 409 });
    return NextResponse.json({ video: saved, plan, sceneId, provider: "fixture" });
  } catch (error) {
    console.error("scene regeneration failed", error);
    return NextResponse.json({ error: "scene_regeneration_failed" }, { status: 400 });
  }
}
