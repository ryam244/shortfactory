import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { videoOutputs, videos, workspaces } from "@shortfactory/db";
import { getDb } from "../../../../../lib/db";
import { getRequestSession } from "../../../../../lib/session";
import { getStorage } from "../../../../../lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const db = getDb();
    const [ownedVideo] = await db.select({ id: videos.id }).from(videos)
      .innerJoin(workspaces, eq(videos.workspaceId, workspaces.id))
      .where(and(eq(videos.id, id), eq(workspaces.ownerUserId, session.subject))).limit(1);
    if (!ownedVideo) return NextResponse.json({ error: "video_not_found" }, { status: 404 });
    const [output] = await db.select().from(videoOutputs).where(eq(videoOutputs.videoId, id)).orderBy(desc(videoOutputs.createdAt)).limit(1);
    if (!output) return NextResponse.json({ error: "output_not_ready" }, { status: 404 });
    const bytes = await getStorage().get(output.storageKey);
    return new Response(bytes.buffer as ArrayBuffer, { headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.byteLength), "Content-Disposition": `attachment; filename="shortfactory-${id}-v${output.videoVersion}.mp4"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("video output failed", error);
    return NextResponse.json({ error: "output_unavailable" }, { status: 404 });
  }
}
