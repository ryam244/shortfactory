import type { GeneratedAudio, VoiceProvider, VoiceRequest } from "./index";

export interface VoicevoxProviderOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

/** VOICEVOX Engineのaudio_query/synthesis APIを使うVoiceProvider。 */
export class VoicevoxProvider implements VoiceProvider {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: VoicevoxProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021").replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
  }

  async synthesize(input: VoiceRequest): Promise<GeneratedAudio> {
    const speaker = parseSpeakerId(input.voiceId);
    const queryUrl = new URL(`${this.baseUrl}/audio_query`);
    queryUrl.searchParams.set("text", input.text);
    queryUrl.searchParams.set("speaker", String(speaker));

    const queryResponse = await this.fetcher(queryUrl, { method: "POST" });
    await assertOk(queryResponse, "audio_query");
    const query = await queryResponse.json();

    const synthesisUrl = new URL(`${this.baseUrl}/synthesis`);
    synthesisUrl.searchParams.set("speaker", String(speaker));
    const synthesisResponse = await this.fetcher(synthesisUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });
    await assertOk(synthesisResponse, "synthesis");
    const bytes = new Uint8Array(await synthesisResponse.arrayBuffer());

    return {
      bytes,
      durationMs: parseWavDurationMs(bytes),
      contentType: "audio/wav",
    };
  }
}

function parseSpeakerId(value: string): number {
  const speaker = Number(value);
  if (!Number.isInteger(speaker) || speaker < 0) {
    throw new Error(`VOICEVOXのvoiceIdは0以上の整数が必要です: ${value}`);
  }
  return speaker;
}

async function assertOk(response: Response, operation: string): Promise<void> {
  if (response.ok) return;
  const detail = (await response.text()).slice(0, 300);
  throw new Error(`VOICEVOX ${operation} failed (${response.status}): ${detail}`);
}

function parseWavDurationMs(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 44 || ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") {
    throw new Error("VOICEVOXの応答がWAV形式ではありません");
  }

  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= view.byteLength) {
    const chunkId = ascii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkData = offset + 8;
    if (chunkId === "fmt " && chunkSize >= 16 && chunkData + 16 <= view.byteLength) {
      byteRate = view.getUint32(chunkData + 8, true);
    }
    if (chunkId === "data") {
      dataSize = chunkSize;
      break;
    }
    offset = chunkData + chunkSize + (chunkSize % 2);
  }
  if (byteRate <= 0 || dataSize <= 0) throw new Error("WAVの尺情報を読み取れません");
  return Math.round((dataSize / byteRate) * 1000);
}

function ascii(view: DataView, offset: number, length: number): string {
  return String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));
}
