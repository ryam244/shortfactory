import {
  brandKitSchema,
  giftAssetKeysFixture,
  giftBrandFixture,
  giftPlanFixture,
  validateVideoPlan,
  fixtureVoiceDurationMs,
  type BrandKit,
  type VideoPlan,
  type VideoPlanInput,
} from "@shortfactory/contracts";

export interface DirectorInput {
  topic: string;
  brand: BrandKit;
  availableAssetKeys: ReadonlySet<string>;
}

export interface TextProvider {
  generatePlan(input: DirectorInput): Promise<VideoPlan>;
}

export interface VoiceRequest {
  text: string;
  voiceId: string;
}

export interface GeneratedAudio {
  /** TTS実装を接続する前のfixtureでは音声データを生成しない。 */
  bytes: Uint8Array;
  durationMs: number;
  contentType: "audio/wav";
}

export interface VoiceProvider {
  synthesize(input: VoiceRequest): Promise<GeneratedAudio>;
}

export { VoicevoxProvider, parseWavDurationMs, type VoicevoxProviderOptions } from "./voicevox";

/** 外部Directorの出力JSONを、同じ契約検証に通して使うローカル実装。 */
export class JsonTextProvider implements TextProvider {
  constructor(private readonly rawPlan: VideoPlanInput) {}

  async generatePlan(input: DirectorInput): Promise<VideoPlan> {
    const result = validateVideoPlan(this.rawPlan, {
      brand: input.brand,
      availableAssetKeys: input.availableAssetKeys,
    });
    if (!result.ok) {
      throw new Error(`JSON plan is invalid: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join(" / ")}`);
    }
    return result.plan;
  }
}

/** 外部APIなしでDirectorの入出力契約を検証するfixture。 */
export class FixtureTextProvider implements TextProvider {
  async generatePlan(input: DirectorInput): Promise<VideoPlan> {
    const rawPlan = structuredClone(giftPlanFixture);
    const topic = input.topic.trim() || rawPlan.title;
    rawPlan.brandId = input.brand.name;
    rawPlan.title = topic;
    rawPlan.scenes = rawPlan.scenes.map((scene, index) =>
      index === 0
        ? {
            ...scene,
            narration: `${topic}、迷ったらこの3つを思い出して。`,
            caption: topic,
          }
        : scene,
    );

    const result = validateVideoPlan(rawPlan, {
      brand: input.brand,
      availableAssetKeys: input.availableAssetKeys,
    });
    if (!result.ok) {
      throw new Error(`fixture plan is invalid: ${result.issues.map((issue) => issue.message).join(" / ")}`);
    }
    return result.plan;
  }
}

/** TTS接続前の決定的fixture。無音WAVで音声経路と尺を検証する。 */
export class FixtureVoiceProvider implements VoiceProvider {
  async synthesize(input: VoiceRequest): Promise<GeneratedAudio> {
    const durationMs = fixtureVoiceDurationMs(input.text);
    return { bytes: silentWav(durationMs), durationMs, contentType: "audio/wav" };
  }
}

function silentWav(durationMs: number): Uint8Array {
  const sampleRate = 16_000;
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const dataSize = Math.round((durationMs / 1000) * byteRate);
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, value: string) => {
    [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  return bytes;
}

export function createGiftFixtureProviders(): {
  brand: BrandKit;
  assetKeys: ReadonlySet<string>;
  text: TextProvider;
  voice: VoiceProvider;
} {
  return {
    brand: brandKitSchema.parse(giftBrandFixture),
    assetKeys: new Set(giftAssetKeysFixture),
    text: new FixtureTextProvider(),
    voice: new FixtureVoiceProvider(),
  };
}
