import { asc, eq } from "drizzle-orm";
import { brandKitSchema, type BrandKitInput } from "@shortfactory/contracts";
import type { ShortFactoryDb } from "../client";
import { brands } from "../schema";

export function createBrandRepository(db: ShortFactoryDb) {
  return {
    async create(input: { workspaceId: string; kit: BrandKitInput }) {
      const kit = brandKitSchema.parse(input.kit);
      const [brand] = await db.insert(brands).values({
        workspaceId: input.workspaceId,
        name: kit.name,
        kitJson: kit,
        readingDictJson: kit.readingDict,
      }).returning();
      return brand!;
    },

    async listByWorkspace(workspaceId: string) {
      return db.select().from(brands).where(eq(brands.workspaceId, workspaceId)).orderBy(asc(brands.createdAt));
    },
  };
}
