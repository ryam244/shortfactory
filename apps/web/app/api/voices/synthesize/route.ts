import { NextResponse } from "next/server";
import { VoicevoxProvider } from "@shortfactory/providers";
import { getRequestSession } from "../../../../lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getRequestSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let input: { text?: unknown; voiceId?: unknown };
  try { input = await request.json() as { text?: unknown; voiceId?: unknown }; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 500 || typeof input.voiceId !== "string" || !input.voiceId.trim()) {
    return NextResponse.json({ error: "text_and_voice_id_required" }, { status: 400 });
  }
  try {
    const audio = await new VoicevoxProvider().synthesize({ text: input.text.trim(), voiceId: input.voiceId.trim() });
    return new Response(audio.bytes.buffer as ArrayBuffer, {
      headers: { "Content-Type": audio.contentType, "Content-Length": String(audio.bytes.byteLength), "Cache-Control": "private, no-store", "X-Audio-Duration-Ms": String(audio.durationMs) },
    });
  } catch (error) {
    console.error("voice synthesis failed", error);
    return NextResponse.json({ error: "voice_synthesis_failed" }, { status: 502 });
  }
}
