import { asc, desc, eq } from "drizzle-orm";
import type { ShortFactoryDb } from "../client";
import { generationCosts, generationJobs } from "../schema";

export function createGenerationRepository(db: ShortFactoryDb) {
  return {
    async createQueuedJob(input: { videoId: string; videoVersion: number; type: "generate_plan" | "render" }) {
      const [job] = await db.insert(generationJobs).values({ videoId: input.videoId, videoVersion: input.videoVersion, type: input.type }).returning();
      return job!;
    },

    async createSucceededJob(input: { videoId: string; videoVersion: number; type: "generate_plan" | "render" }) {
      const [job] = await db.insert(generationJobs).values({
        videoId: input.videoId,
        videoVersion: input.videoVersion,
        type: input.type,
        status: "succeeded",
        step: "completed",
        attempts: 1,
      }).returning();
      return job!;
    },

    async recordEstimatedCost(input: { jobId: string; provider: string; model: string; unit: string; quantity: string; estimatedJpy: string }) {
      const [cost] = await db.insert(generationCosts).values({ ...input }).returning();
      return cost!;
    },

    async listCostsByVideo(videoId: string) {
      return db.select({ cost: generationCosts, job: generationJobs })
        .from(generationCosts)
        .innerJoin(generationJobs, eq(generationCosts.jobId, generationJobs.id))
        .where(eq(generationJobs.videoId, videoId))
        .orderBy(asc(generationCosts.createdAt));
    },

    async listJobsByVideo(videoId: string) {
      return db.select().from(generationJobs).where(eq(generationJobs.videoId, videoId)).orderBy(desc(generationJobs.createdAt));
    },
  };
}
