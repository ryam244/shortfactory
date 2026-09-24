import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createGenerationRepository, videos, workspaces } from "@shortfactory/db";
import { getDb } from "../../../../../lib/db";
import { getRequestSession } from "../../../../../lib/session";

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
    const rows = await createGenerationRepository(db).listCostsByVideo(id);
    const estimatedJpy = rows.reduce((total, row) => total + Number(row.cost.estimatedJpy), 0).toFixed(2);
    return NextResponse.json({ costs: rows.map((row) => ({ ...row.cost, jobType: row.job.type, jobStatus: row.job.status })), estimatedJpy });
  } catch (error) {
    console.error("video costs failed", error);
    return NextResponse.json({ error: "costs_unavailable" }, { status: 503 });
  }
}
