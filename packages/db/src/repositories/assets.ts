import { asc, eq } from "drizzle-orm";
import type { ShortFactoryDb } from "../client";
import { assets } from "../schema";

export function createAssetRepository(db: ShortFactoryDb) {
  return {
    async create(input: {
      workspaceId: string;
      brandId: string;
      key: string;
      kind: string;
      contentType: string;
      storageKey: string;
      source: string;
      rightsNote: string;
      parentAssetId?: string;
    }) {
      const values = {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        key: input.key.trim(),
        kind: input.kind.trim(),
        contentType: input.contentType.trim(),
        storageKey: input.storageKey.trim(),
        source: input.source.trim(),
        rightsNote: input.rightsNote.trim(),
        parentAssetId: input.parentAssetId,
      };
      if (!values.key || !values.kind || !values.contentType || !values.storageKey || !values.source || !values.rightsNote) throw new Error("asset metadata is required");
      const [asset] = await db.insert(assets).values(values).returning();
      return asset!;
    },

    async listByBrand(brandId: string) {
      return db.select().from(assets).where(eq(assets.brandId, brandId)).orderBy(asc(assets.createdAt));
    },
  };
}
