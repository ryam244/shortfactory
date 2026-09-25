import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertGenerationBudget, brandKitSchema, GenerationBudgetExceededError, giftAssetKeysFixture } from "@shortfactory/contracts";
import { FixtureTextProvider, type CreativeBriefInput } from "@shortfactory/providers";
import { brands, createGenerationRepository, createVideoRepository, videos, workspaces } from "@shortfactory/db";
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
    let creativeBrief: CreativeBriefInput | undefined;
    try {
      const input = await request.json() as { requestedImages?: unknown; creativeBrief?: unknown };
      if (input.requestedImages !== undefined) requestedImages = Number(input.requestedImages);
      if (input.creativeBrief !== undefined) {
        if (!isCreativeBrief(input.creativeBrief)) return NextResponse.json({ error: "invalid_creative_brief" }, { status: 400 });
        creativeBrief = input.creativeBrief;
      }
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
      creativeBrief,
    });
    plan.brandId = row.brand.id;
    const savedVideo = await createVideoRepository(db).savePlan(id, plan);
    if (!savedVideo) return NextResponse.json({ error: "video_not_found" }, { status: 404 });
    const job = await createGenerationRepository(db).createSucceededJob({ videoId: id, videoVersion: savedVideo.version, type: "generate_plan" });
    const cost = await createGenerationRepository(db).recordEstimatedCost({ jobId: job.id, provider: "fixture", model: "fixture-director", unit: "plan", quantity: "1", estimatedJpy: "0" });
    return NextResponse.json({ video: savedVideo, plan, provider: "fixture", cost });
  } catch (error) {
    console.error("plan generation failed", error);
    return NextResponse.json({ error: "plan_generation_failed" }, { status: 400 });
  }
}

function isCreativeBrief(value: unknown): value is CreativeBriefInput {
  if (!value || typeof value !== "object") return false;
  const brief = value as Record<string, unknown>;
  return ["audience", "pain", "solution", "proof", "cta"].every((key) => typeof brief[key] === "string" && brief[key].trim().length > 0);
}
