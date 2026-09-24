import { NextResponse } from "next/server";
import { getIdentityRepository } from "../../../lib/db";
import { getRequestSession } from "../../../lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ workspaces: await getIdentityRepository().listWorkspaces(session.subject) });
  } catch (error) {
    console.error("workspace list failed", error);
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let input: { name?: unknown };
  try {
    input = await request.json() as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof input.name !== "string" || !input.name.trim()) return NextResponse.json({ error: "name_required" }, { status: 400 });
  try {
    const workspace = await getIdentityRepository().createWorkspace({ ownerUserId: session.subject, name: input.name });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error("workspace creation failed", error);
    return NextResponse.json({ error: "workspace_creation_failed" }, { status: 400 });
  }
}
