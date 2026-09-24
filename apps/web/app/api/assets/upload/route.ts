import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { brands, createAssetRepository, workspaces } from "@shortfactory/db";
import { getDb } from "../../../../lib/db";
import { getRequestSession } from "../../../../lib/session";
import { getStorage } from "../../../../lib/storage";

export const runtime = "nodejs";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const assetKeyPattern = /^[a-z0-9][a-z0-9_]*$/;
const contentTypePattern = /^(image|audio|video)\/[a-z0-9.+-]+$/i;

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const workspaceId = form.get("workspaceId");
  const brandId = form.get("brandId");
  const key = form.get("key");
  const kind = form.get("kind");
  const source = form.get("source");
  const rightsNote = form.get("rightsNote");
  if (!(file instanceof File) || typeof workspaceId !== "string" || typeof brandId !== "string" || typeof key !== "string" || typeof kind !== "string" || typeof source !== "string" || typeof rightsNote !== "string") return NextResponse.json({ error: "file_and_asset_metadata_required" }, { status: 400 });
  if (!key || !assetKeyPattern.test(key)) return NextResponse.json({ error: "invalid_asset_key" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "file_size_invalid" }, { status: 400 });
  if (!file.type || !contentTypePattern.test(file.type)) return NextResponse.json({ error: "unsupported_content_type" }, { status: 400 });
  if (!kind.trim() || !source.trim() || !rightsNote.trim()) return NextResponse.json({ error: "asset_metadata_required" }, { status: 400 });

  const db = getDb();
  const [ownedBrand] = await db.select({ id: brands.id }).from(brands)
    .innerJoin(workspaces, eq(brands.workspaceId, workspaces.id))
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, workspaceId), eq(workspaces.ownerUserId, session.subject))).limit(1);
  if (!ownedBrand) return NextResponse.json({ error: "brand_forbidden" }, { status: 403 });

  const storageKey = `assets/${brandId}/${key}`;
  const storage = getStorage();
  try {
    await storage.put(storageKey, new Uint8Array(await file.arrayBuffer()), file.type);
    const asset = await createAssetRepository(db).create({ workspaceId, brandId, key, kind, contentType: file.type, storageKey, source, rightsNote });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    console.error("asset upload failed", error);
    return NextResponse.json({ error: "asset_upload_failed" }, { status: 400 });
  }
}
