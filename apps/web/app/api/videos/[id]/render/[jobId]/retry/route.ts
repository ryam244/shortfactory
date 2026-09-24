import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generationJobs, videos, workspaces } from "@shortfactory/db";
import { getDb } from "../../../../../../../lib/db";
import { getRequestSession } from "../../../../../../../lib/session";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string; jobId: string }> }) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, jobId } = await context.params;
  try {
    const db = getDb();
    const [job] = await db.select({ job: generationJobs }).from(generationJobs)
      .innerJoin(videos, eq(generationJobs.videoId, videos.id))
      .innerJoin(workspaces, eq(videos.workspaceId, workspaces.id))
      .where(and(eq(generationJobs.id, jobId), eq(generationJobs.videoId, id), eq(workspaces.ownerUserId, session.subject))).limit(1);
    if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
    if (job.job.status !== "failed" && job.job.status !== "cancelled") return NextResponse.json({ error: "job_not_retryable", status: job.job.status }, { status: 409 });
    const [updated] = await db.update(generationJobs).set({ status: "queued", step: "manual_retry", attempts: 0, errorCode: null, leaseUntil: null }).where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, job.job.status))).returning();
    if (!updated) return NextResponse.json({ error: "job_not_retryable" }, { status: 409 });
    return NextResponse.json({ job: updated });
  } catch (error) {
    console.error("render job retry failed", error);
    return NextResponse.json({ error: "render_job_retry_failed" }, { status: 400 });
  }
}
