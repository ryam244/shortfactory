import { fileURLToPath } from 'node:url';
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
  const kit = brandKitSchema.parse({ ...giftBrandFixture, name: '贈る気持ち｜編集サンプル', voice: { provider: 'voicevox', voiceId: '3' }, colors: { ...giftBrandFixture.colors, primary: '#DD775F', accent: '#91B4A4', text: '#393B44' } });
  // A separate brand preserves existing user videos and voice assets.
  const brand = await createBrandRepository(db).create({ workspaceId: workspace.id, kit });
  const rows = createAssetRepository(db);
  for (const [key, artwork] of Object.entries(editorialAssets)) {
    const storageKey = `assets/${brand.id}/${key.replace('/', '__')}.svg`;
    await storage.put(storageKey, new TextEncoder().encode(artwork), 'image/svg+xml');
    await rows.create({ workspaceId: workspace.id, brandId: brand.id, key, kind: key.startsWith('gift_girl') ? 'character' : ['shop_shelf','room_warm','desk'].includes(key) ? 'background' : 'object', storageKey, contentType: 'image/svg+xml', source: 'Short Factory original vector artwork v1', rightsNote: '本リポジトリで新規制作したベクター素材。外部のキャラクター画像は使用していません。' });
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
  const input: VideoPlanInput = { schemaVersion: 1, template: 'yuru_anime_v1', brandId: brand.id, title: '高いほうなら、安心？', fps: 30, cta: '迷った日に、思い出して', scenes: beats.map(([caption,narration,expressionKey,backgroundKey,objectKeys,motion], i) => ({ id: `scene-${String(i+1).padStart(2,'0')}`, role: i === 0 ? 'hook' : i === 6 ? 'cta' : 'body', caption, narration, visual: { characterKey: 'gift_girl', expressionKey, backgroundKey, objectKeys: [...objectKeys] }, motion, minDurationMs: 2800, maxDurationMs: 6000 })) };
  const valid = validateVideoPlan(input, { brand: kit, availableAssetKeys: new Set(Object.keys(editorialAssets)) });
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
