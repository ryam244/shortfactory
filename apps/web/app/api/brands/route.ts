import { NextResponse } from "next/server";
import { brandKitSchema } from "@shortfactory/contracts";
import { getDb, getIdentityRepository } from "../../../lib/db";
import { getRequestSession } from "../../../lib/session";
import { createBrandRepository } from "@shortfactory/db";

export const runtime = "nodejs";

async function getOwnedWorkspaceIds(userId: string) {
  const workspaces = await getIdentityRepository().listWorkspaces(userId);
  return new Set(workspaces.map((workspace) => workspace.id));
}

export async function GET() {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const workspaces = await getIdentityRepository().listWorkspaces(session.subject);
    const repository = createBrandRepository(getDb());
    const brands = (await Promise.all(workspaces.map((workspace) => repository.listByWorkspace(workspace.id)))).flat();
    return NextResponse.json({ brands });
  } catch (error) {
    console.error("brand list failed", error);
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let input: { workspaceId?: unknown; kit?: unknown };
  try {
    input = await request.json() as { workspaceId?: unknown; kit?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof input.workspaceId !== "string" || !input.kit || typeof input.kit !== "object") {
    return NextResponse.json({ error: "workspace_id_and_kit_required" }, { status: 400 });
  }
  const parsedKit = brandKitSchema.safeParse(input.kit);
  if (!parsedKit.success) return NextResponse.json({ error: "invalid_brand_kit" }, { status: 400 });

  try {
    if (!(await getOwnedWorkspaceIds(session.subject)).has(input.workspaceId)) {
      return NextResponse.json({ error: "workspace_forbidden" }, { status: 403 });
    }
    const repository = createBrandRepository(getDb());
    const brand = await repository.create({ workspaceId: input.workspaceId, kit: parsedKit.data });
    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    console.error("brand creation failed", error);
    return NextResponse.json({ error: "invalid_brand_or_database_unavailable" }, { status: 400 });
  }
}
