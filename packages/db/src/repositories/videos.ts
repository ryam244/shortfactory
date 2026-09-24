import { eq } from "drizzle-orm";
import type { VideoPlan } from "@shortfactory/contracts";
import type { ShortFactoryDb } from "../client";
import { videos } from "../schema";

export function createVideoRepository(db: ShortFactoryDb) {
  return {
    async create(input: { workspaceId: string; brandId: string; topic: string }) {
      const topic = input.topic.trim();
      if (!topic) throw new Error("topicは必須です");
      const [video] = await db.insert(videos).values({ workspaceId: input.workspaceId, brandId: input.brandId, topic }).returning();
      return video!;
    },

    async findById(id: string) {
      const [video] = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
      return video ?? null;
    },

    async savePlan(id: string, plan: VideoPlan) {
      const [video] = await db.update(videos).set({ planJson: plan, status: "draft", version: 1 }).where(eq(videos.id, id)).returning();
      return video ?? null;
    },
  };
}
