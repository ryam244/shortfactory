import { relations } from "drizzle-orm";
import { integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const videoStatus = pgEnum("video_status", ["draft", "generating", "ready", "failed"]);
export const generationJobType = pgEnum("generation_job_type", ["generate_plan", "render"]);
export const generationJobStatus = pgEnum("generation_job_status", ["queued", "running", "succeeded", "failed", "cancelled"]);
const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull();

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(), email: text().notNull().unique(), passwordHash: text("password_hash").notNull(), createdAt: createdAt(),
});
export const workspaces = pgTable("workspaces", {
  id: uuid().defaultRandom().primaryKey(), ownerUserId: uuid("owner_user_id").notNull().references(() => users.id), name: text().notNull(), createdAt: createdAt(),
});
export const brands = pgTable("brands", {
  id: uuid().defaultRandom().primaryKey(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id), name: text().notNull(),
  kitJson: jsonb("kit_json").notNull().$type<Record<string, unknown>>(), readingDictJson: jsonb("reading_dict_json").notNull().$type<Record<string, string>>().default({}), createdAt: createdAt(),
});
export const videos = pgTable("videos", {
  id: uuid().defaultRandom().primaryKey(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id), brandId: uuid("brand_id").notNull().references(() => brands.id),
  topic: text().notNull(), status: videoStatus().notNull().default("draft"), planJson: jsonb("plan_json").$type<Record<string, unknown>>(), version: integer().notNull().default(1), createdAt: createdAt(),
});
export const assets = pgTable("assets", {
  id: uuid().defaultRandom().primaryKey(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id), brandId: uuid("brand_id").notNull().references(() => brands.id),
  key: text().notNull(), kind: text().notNull(), contentType: text("content_type").notNull(), storageKey: text("storage_key").notNull(), parentAssetId: uuid("parent_asset_id"), rightsNote: text("rights_note").notNull(), source: text().notNull(), createdAt: createdAt(),
}, (table) => [unique("assets_brand_key_unique").on(table.brandId, table.key)]);
export const generationJobs = pgTable("generation_jobs", {
  id: uuid().defaultRandom().primaryKey(), videoId: uuid("video_id").notNull().references(() => videos.id), videoVersion: integer("video_version").notNull(), type: generationJobType().notNull(),
  status: generationJobStatus().notNull().default("queued"), step: text(), attempts: integer().notNull().default(0), leaseUntil: timestamp("lease_until", { withTimezone: true, mode: "string" }), errorCode: text("error_code"), createdAt: createdAt(),
});
export const generationCosts = pgTable("generation_costs", {
  id: uuid().defaultRandom().primaryKey(), jobId: uuid("job_id").notNull().references(() => generationJobs.id), provider: text().notNull(), model: text().notNull(), unit: text().notNull(),
  quantity: numeric({ precision: 12, scale: 4 }).notNull(), estimatedJpy: numeric("estimated_jpy", { precision: 12, scale: 2 }).notNull(), actualJpy: numeric("actual_jpy", { precision: 12, scale: 2 }), createdAt: createdAt(),
});
export const videoOutputs = pgTable("video_outputs", {
  id: uuid().defaultRandom().primaryKey(), videoId: uuid("video_id").notNull().references(() => videos.id), videoVersion: integer("video_version").notNull(), storageKey: text("storage_key").notNull(), durationMs: integer("duration_ms").notNull(), width: integer().notNull(), height: integer().notNull(), createdAt: createdAt(),
});

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({ owner: one(users, { fields: [workspaces.ownerUserId], references: [users.id] }), brands: many(brands), videos: many(videos), assets: many(assets) }));
export const brandsRelations = relations(brands, ({ one, many }) => ({ workspace: one(workspaces, { fields: [brands.workspaceId], references: [workspaces.id] }), videos: many(videos), assets: many(assets) }));
export const videosRelations = relations(videos, ({ one, many }) => ({ workspace: one(workspaces, { fields: [videos.workspaceId], references: [workspaces.id] }), brand: one(brands, { fields: [videos.brandId], references: [brands.id] }), jobs: many(generationJobs), outputs: many(videoOutputs) }));
export const assetsRelations = relations(assets, ({ one }) => ({ workspace: one(workspaces, { fields: [assets.workspaceId], references: [workspaces.id] }), brand: one(brands, { fields: [assets.brandId], references: [brands.id] }), parent: one(assets, { fields: [assets.parentAssetId], references: [assets.id] }) }));
export const generationJobsRelations = relations(generationJobs, ({ one, many }) => ({ video: one(videos, { fields: [generationJobs.videoId], references: [videos.id] }), costs: many(generationCosts) }));
export const generationCostsRelations = relations(generationCosts, ({ one }) => ({ job: one(generationJobs, { fields: [generationCosts.jobId], references: [generationJobs.id] }) }));
export const videoOutputsRelations = relations(videoOutputs, ({ one }) => ({ video: one(videos, { fields: [videoOutputs.videoId], references: [videos.id] }) }));
