import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assets, brands, createAssetRepository, workspaces } from "@shortfactory/db";
import { getDb } from "../../../lib/db";
import { getRequestSession } from "../../../lib/session";

export const runtime = "nodejs";
const assetKeyPattern = /^[a-z0-9][a-z0-9_]*$/;

export async function GET(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const brandId = new URL(request.url).searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brand_id_required" }, { status: 400 });
  try {
    const db = getDb();
    const [ownedBrand] = await db.select({ id: brands.id }).from(brands)
      .innerJoin(workspaces, eq(brands.workspaceId, workspaces.id))
      .where(and(eq(brands.id, brandId), eq(workspaces.ownerUserId, session.subject))).limit(1);
    if (!ownedBrand) return NextResponse.json({ error: "brand_forbidden" }, { status: 403 });
    return NextResponse.json({ assets: await createAssetRepository(db).listByBrand(brandId) });
  } catch (error) {
    console.error("asset list failed", error);
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const required = ["workspaceId", "brandId", "key", "kind", "storageKey", "source", "rightsNote"];
  if (required.some((field) => typeof input[field] !== "string" || !(input[field] as string).trim())) return NextResponse.json({ error: "asset_metadata_required" }, { status: 400 });
  if (!assetKeyPattern.test(input.key as string)) return NextResponse.json({ error: "invalid_asset_key" }, { status: 400 });

  try {
    const db = getDb();
    const [ownedBrand] = await db.select({ id: brands.id }).from(brands)
      .innerJoin(workspaces, eq(brands.workspaceId, workspaces.id))
      .where(and(eq(brands.id, input.brandId as string), eq(brands.workspaceId, input.workspaceId as string), eq(workspaces.ownerUserId, session.subject))).limit(1);
    if (!ownedBrand) return NextResponse.json({ error: "brand_forbidden" }, { status: 403 });
    const asset = await createAssetRepository(db).create({
      workspaceId: input.workspaceId as string, brandId: input.brandId as string, key: input.key as string,
      kind: input.kind as string, contentType: typeof input.contentType === "string" ? input.contentType : "application/octet-stream", storageKey: input.storageKey as string, source: input.source as string,
      rightsNote: input.rightsNote as string, parentAssetId: typeof input.parentAssetId === "string" ? input.parentAssetId : undefined,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error("asset registration failed", error);
    return NextResponse.json({ error: "asset_registration_failed" }, { status: 400 });
  }
}
