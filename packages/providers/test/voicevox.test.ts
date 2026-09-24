import { describe, expect, it } from "vitest";
import { VoicevoxProvider } from "../src/voicevox";

function wavBytes(durationMs: number): Uint8Array {
  const sampleRate = 16_000;
  const channels = 1;
  const bits = 16;
  const byteRate = sampleRate * channels * (bits / 8);
  const dataSize = Math.round((durationMs / 1000) * byteRate);
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channels * (bits / 8), true);
  view.setUint16(34, bits, true);
  text(36, "data");
  view.setUint32(40, dataSize, true);
  return bytes;
}

describe("VoicevoxProvider", () => {
  it("audio_queryからWAVを合成し、実測尺を返す", async () => {
    const requests: Request[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      if (requests.length === 1) return new Response(JSON.stringify({ speedScale: 1 }));
      return new Response(new Blob([wavBytes(1500).buffer as ArrayBuffer]), {
        headers: { "content-type": "audio/wav" },
      });
    };
    const provider = new VoicevoxProvider({ baseUrl: "http://voicevox.test", fetcher });

    const result = await provider.synthesize({ text: "春の手土産", voiceId: "3" });

    expect(result.contentType).toBe("audio/wav");
    expect(result.durationMs).toBe(1500);
    expect(requests[0]!.method).toBe("POST");
    expect(new URL(requests[0]!.url).searchParams.get("speaker")).toBe("3");
    expect(requests[1]!.method).toBe("POST");
  });

  it("voiceIdが整数でなければ接続前に拒否する", async () => {
    const provider = new VoicevoxProvider({ fetcher: async () => new Response() });
    await expect(provider.synthesize({ text: "テスト", voiceId: "unset" })).rejects.toThrow("整数");
  });
});
