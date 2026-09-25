import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { brandKitSchema, giftBrandFixture, validateVideoPlan, resolveSceneTiming, type VideoPlanInput } from '@shortfactory/contracts';
import { createDb, createIdentityRepository, createBrandRepository, createAssetRepository, createVideoRepository, createGenerationRepository } from '@shortfactory/db';
import { VoicevoxProvider } from '@shortfactory/providers';
import { LocalStorageProvider } from '@shortfactory/storage';
import { editorialAssets } from './lib/editorial-assets';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const storage = new LocalStorageProvider(path.resolve(root, process.env.SHORTFACTORY_STORAGE_ROOT ?? 'storage'));
const { db, pool } = createDb();
try {
  const identity = createIdentityRepository(db);
  const user = await identity.findUserByEmail(process.env.SHORTFACTORY_ADMIN_EMAIL ?? 'local-admin@example.com');
  if (!user) throw new Error('Seed an account first');
  const [workspace] = await identity.listWorkspaces(user.id);
  if (!workspace) throw new Error('Workspace required');
  const hasExternalMedia = Boolean(process.env.SHORTFACTORY_BGM_FILE || process.env.SHORTFACTORY_MJ_BACKGROUND);
  const kit = brandKitSchema.parse({ ...giftBrandFixture, name: hasExternalMedia ? '贈る気持ち｜実素材サンプル' : '贈る気持ち｜編集サンプル', voice: { provider: 'voicevox', voiceId: '3' }, colors: { ...giftBrandFixture.colors, primary: '#DD775F', accent: '#91B4A4', text: '#393B44' } });
  // A separate brand preserves existing user videos and voice assets.
  const brand = await createBrandRepository(db).create({ workspaceId: workspace.id, kit });
  const rows = createAssetRepository(db);
  const paintedCharacterPaths: Record<string, string | undefined> = {
    gift_girl: process.env.SHORTFACTORY_PAINTED_CHARACTER_THINK,
    'gift_girl/think': process.env.SHORTFACTORY_PAINTED_CHARACTER_THINK,
    'gift_girl/smile': process.env.SHORTFACTORY_PAINTED_CHARACTER_SMILE,
    'gift_girl/surprise': process.env.SHORTFACTORY_PAINTED_CHARACTER_SURPRISE,
  };
  for (const [key, artwork] of Object.entries(editorialAssets)) {
    const paintedCharacter = key.startsWith('gift_girl') ? paintedCharacterPaths[key] : undefined;
    const isMidjourneyBackground = key === 'shop_shelf' && process.env.SHORTFACTORY_MJ_BACKGROUND;
    const externalPath = paintedCharacter || isMidjourneyBackground;
    const contentType = externalPath ? 'image/png' : 'image/svg+xml';
    const storageKey = `assets/${brand.id}/${key.replace('/', '__')}.${externalPath ? 'png' : 'svg'}`;
    await storage.put(storageKey, externalPath ? new Uint8Array(await readFile(externalPath)) : new TextEncoder().encode(artwork), contentType);
    const source = paintedCharacter ? 'ImageGen生成 / Midjourney背景の画風参照' : isMidjourneyBackground ? 'Midjourney生成 / 39d34f44-a10f-44e1-b4b3-da3f3dece259' : 'Short Factory original vector artwork v1';
    const rightsNote = paintedCharacter ? 'プロジェクト用に生成した人物素材。公開前に生成サービスの利用条件を確認する' : isMidjourneyBackground ? 'ユーザー所有アカウントで生成。公開前にMidjourneyのプラン・利用規約・商用利用条件を確認する' : '本リポジトリで新規制作したベクター素材。外部のキャラクター画像は使用していません。';
    await rows.create({ workspaceId: workspace.id, brandId: brand.id, key, kind: key.startsWith('gift_girl') ? 'character' : ['shop_shelf','room_warm','desk'].includes(key) ? 'background' : 'object', storageKey, contentType, source, rightsNote });
  }
  const bgmKey = 'bgm_cozy_gift_shop';
  if (process.env.SHORTFACTORY_BGM_FILE) {
    const storageKey = `audio/${brand.id}/${bgmKey}.wav`;
    await storage.put(storageKey, new Uint8Array(await readFile(process.env.SHORTFACTORY_BGM_FILE)), 'audio/wav');
    await rows.create({ workspaceId: workspace.id, brandId: brand.id, key: bgmKey, kind: 'bgm', storageKey, contentType: 'audio/wav', source: 'Suno生成「Cozy Gift Shop」 / 6a01cb54-4757-4a73-a22c-80942c2d5b47', rightsNote: 'ユーザー所有のSuno Proアカウントで生成。公開前にSunoのプラン・利用規約・商用利用条件を確認する' });
  }
  const beats = [
    ['高いほうなら、安心？', '高いほうなら、喜んでもらえるかな。', 'think', 'shop_shelf', ['gift_box'], 'slow_zoom'],
    ['選ぶほど、わからない', 'でも、選ぶほど、わからなくなる。', 'think', 'shop_shelf', ['gift_box', 'cookie'], 'pan_right'],
    ['あ、前に言ってた', 'あ、前に、クッキーが好きって言ってた。', 'surprise', 'desk', ['cookie'], 'bounce'],
    ['好き、を覚えていた', '好きなものを、覚えていた。それだけでいい。', 'smile', 'room_warm', ['cookie'], 'slow_zoom'],
    ['「好きって言ってたから」', '好きって言ってたから。カードにひとこと。', 'smile', 'desk', ['card'], 'slide_up'],
    ['値段より、あなたへの気持ち', '渡したいのは、値段より、あなたを思い出した気持ち。', 'smile', 'room_warm', ['gift_box'], 'slow_zoom'],
    ['迷った日に、思い出して', '次に迷った日、この選び方を思い出してね。', 'smile', 'room_warm', ['card'], 'none'],
  ] as const;
  const selectedBackgroundKey = process.env.SHORTFACTORY_MJ_BACKGROUND ? 'shop_shelf' : null;
  const input: VideoPlanInput = { schemaVersion: 1, template: 'yuru_anime_v1', brandId: brand.id, title: '高いほうなら、安心？', fps: 30, ...(process.env.SHORTFACTORY_BGM_FILE ? { bgm: { enabled: true, assetKey: bgmKey, volume: 0.07 } } : {}), cta: '迷った日に、思い出して', scenes: beats.map(([caption,narration,expressionKey,backgroundKey,objectKeys,motion], i) => ({ id: `scene-${String(i+1).padStart(2,'0')}`, role: i === 0 ? 'hook' : i === 6 ? 'cta' : 'body', caption, narration, visual: { characterKey: 'gift_girl', expressionKey, backgroundKey: selectedBackgroundKey ?? backgroundKey, objectKeys: [...objectKeys] }, motion, minDurationMs: 2800, maxDurationMs: 6000 })) };
  const valid = validateVideoPlan(input, { brand: kit, availableAssetKeys: new Set([...Object.keys(editorialAssets), ...(process.env.SHORTFACTORY_BGM_FILE ? [bgmKey] : [])]) });
  if (!valid.ok) throw new Error(JSON.stringify(valid.issues));
  const voice = new VoicevoxProvider();
  const durations: number[] = [];
  for (const scene of valid.plan.scenes) {
    const audio = await voice.synthesize({ text: scene.narration, voiceId: '3' });
    durations.push(audio.durationMs);
    const key = `tts_${scene.id}_editorial`;
    const storageKey = `audio/${brand.id}/${key}.wav`;
    await storage.put(storageKey, audio.bytes, audio.contentType);
    await rows.create({ workspaceId: workspace.id, brandId: brand.id, key, kind: 'tts', storageKey, contentType: audio.contentType, source: 'VOICEVOX:ずんだもん', rightsNote: 'VOICEVOX:ずんだもん。公開時はクレジットを掲載し、音声・キャラクターの利用条件を確認。' });
  }
  const timing = resolveSceneTiming(valid.plan.scenes.map((scene,i) => ({scene,narrationMs:durations[i]!})), 30);
  if (timing.outOfRange || timing.overflowingScenes.length) throw new Error(`Adjust script timing: ${JSON.stringify(timing)}`);
  const repository = createVideoRepository(db);
  const video = await repository.create({ workspaceId: workspace.id, brandId: brand.id, topic: input.title });
  await repository.savePlan(video.id, valid.plan);
  const job = await createGenerationRepository(db).createQueuedJob({ videoId: video.id, videoVersion: 1, type: 'render' });
  console.log(JSON.stringify({videoId: video.id, jobId: job.id, brandId: brand.id, timing}, null, 2));
} finally { await pool.end(); }
