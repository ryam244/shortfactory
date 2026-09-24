import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { brands, createAssetRepository, videos, workspaces } from "@shortfactory/db";
import { VoicevoxProvider } from "@shortfactory/providers";
import { getDb } from "../../../../lib/db";
import { getRequestSession } from "../../../../lib/session";
import { getStorage } from "../../../../lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let input: { text?: unknown; voiceId?: unknown; videoId?: unknown; sceneId?: unknown; persist?: unknown };
  try { input = await request.json() as { text?: unknown; voiceId?: unknown; videoId?: unknown; sceneId?: unknown; persist?: unknown }; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 500 || typeof input.voiceId !== "string" || !input.voiceId.trim()) {
    return NextResponse.json({ error: "text_and_voice_id_required" }, { status: 400 });
  }
  try {
    const audio = await new VoicevoxProvider().synthesize({ text: input.text.trim(), voiceId: input.voiceId.trim() });
    if (input.persist === true) {
      if (typeof input.videoId !== "string" || typeof input.sceneId !== "string" || !input.sceneId.trim()) return NextResponse.json({ error: "video_and_scene_required" }, { status: 400 });
      const db = getDb();
      const [row] = await db.select({ video: videos, brand: brands }).from(videos)
        .innerJoin(brands, eq(videos.brandId, brands.id))
        .innerJoin(workspaces, eq(videos.workspaceId, workspaces.id))
        .where(and(eq(videos.id, input.videoId), eq(workspaces.ownerUserId, session.subject))).limit(1);
      if (!row) return NextResponse.json({ error: "video_not_found" }, { status: 404 });
      const safeSceneId = input.sceneId.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const key = `tts_${safeSceneId}_${Date.now()}`;
      const storageKey = `audio/${row.video.brandId}/${key}`;
      const storage = getStorage();
      await storage.put(storageKey, audio.bytes, audio.contentType);
      try {
        const asset = await createAssetRepository(db).create({
          workspaceId: row.video.workspaceId,
          brandId: row.video.brandId,
          key,
          kind: "tts",
          contentType: audio.contentType,
          storageKey,
          source: "VOICEVOX",
          rightsNote: "VOICEVOX利用規約・音声ライブラリ規約を確認",
        });
        return NextResponse.json({ asset, durationMs: audio.durationMs });
      } catch (error) {
        await storage.delete(storageKey).catch(() => undefined);
        throw error;
      }
    }
    return new Response(audio.bytes.buffer as ArrayBuffer, {
      headers: { "Content-Type": audio.contentType, "Content-Length": String(audio.bytes.byteLength), "Cache-Control": "private, no-store", "X-Audio-Duration-Ms": String(audio.durationMs) },
    });
  } catch (error) {
    console.error("voice synthesis failed", error);
    return NextResponse.json({ error: "voice_synthesis_failed" }, { status: 502 });
  }
}
