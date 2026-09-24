import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createGenerationRepository, videos, workspaces } from "@shortfactory/db";
import { getDb } from "../../../../../lib/db";
import { getRequestSession } from "../../../../../lib/session";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const db = getDb();
    const [video] = await db.select({ video: videos }).from(videos)
      .innerJoin(workspaces, eq(videos.workspaceId, workspaces.id))
      .where(and(eq(videos.id, id), eq(workspaces.ownerUserId, session.subject))).limit(1);
    if (!video) return NextResponse.json({ error: "video_not_found" }, { status: 404 });
    if (!video.video.planJson) return NextResponse.json({ error: "plan_required" }, { status: 400 });
    const job = await createGenerationRepository(db).createQueuedJob({ videoId: id, videoVersion: video.video.version, type: "render" });
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    console.error("render job creation failed", error);
    return NextResponse.json({ error: "render_job_creation_failed" }, { status: 400 });
  }
}

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
    return NextResponse.json({ jobs: await createGenerationRepository(db).listJobsByVideo(id) });
  } catch (error) {
    console.error("render jobs lookup failed", error);
    return NextResponse.json({ error: "render_jobs_unavailable" }, { status: 503 });
  }
}
