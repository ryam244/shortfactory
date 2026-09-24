import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertGenerationBudget, brandKitSchema, GenerationBudgetExceededError, giftAssetKeysFixture } from "@shortfactory/contracts";
import { FixtureTextProvider } from "@shortfactory/providers";
import { brands, createVideoRepository, videos, workspaces } from "@shortfactory/db";
import { getDb } from "../../../../../lib/db";
import { getRequestSession } from "../../../../../lib/session";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;

  try {
    const db = getDb();
    const [row] = await db.select({ video: videos, brand: brands }).from(videos)
      .innerJoin(brands, eq(videos.brandId, brands.id))
      .innerJoin(workspaces, eq(videos.workspaceId, workspaces.id))
      .where(and(eq(videos.id, id), eq(workspaces.ownerUserId, session.subject)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "video_not_found" }, { status: 404 });

    const brand = brandKitSchema.parse(row.brand.kitJson);
    let requestedImages = 0;
    try {
      const input = await request.json() as { requestedImages?: unknown };
      if (input.requestedImages !== undefined) requestedImages = Number(input.requestedImages);
    } catch {
      // An empty POST body is the normal fixture path.
    }
    try {
      assertGenerationBudget(brand, requestedImages);
    } catch (error) {
      if (error instanceof GenerationBudgetExceededError) {
        return NextResponse.json({ error: error.code, requestedImages: error.requestedImages, maxGeneratedImages: error.maxGeneratedImages }, { status: 429 });
      }
      return NextResponse.json({ error: "invalid_generation_budget" }, { status: 400 });
    }
    const plan = await new FixtureTextProvider().generatePlan({
      topic: row.video.topic,
      brand,
      availableAssetKeys: new Set(giftAssetKeysFixture),
    });
    plan.brandId = row.brand.id;
    const savedVideo = await createVideoRepository(db).savePlan(id, plan);
    return NextResponse.json({ video: savedVideo, plan, provider: "fixture" });
  } catch (error) {
    console.error("plan generation failed", error);
    return NextResponse.json({ error: "plan_generation_failed" }, { status: 400 });
  }
}
