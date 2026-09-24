import { giftBrandFixture } from "@shortfactory/contracts";
import { createAssetRepository, createBrandRepository, createDb } from "../src/index";
import { createIdentityRepository } from "../src/repositories/identity";
import { LocalStorageProvider } from "@shortfactory/storage";
import path from "node:path";
import { existsSync } from "node:fs";

const DEMO_ASSET_KEYS = [
  "gift_girl",
  "gift_girl/think",
  "gift_girl/smile",
  "gift_girl/surprise",
  "room_warm",
  "shop_shelf",
  "desk",
  "gift_box",
  "cookie",
  "card",
] as const;

const email = process.env.SHORTFACTORY_ADMIN_EMAIL?.trim().toLowerCase() || "local-admin@example.com";
const workspaceRoot = existsSync(path.resolve(process.cwd(), "pnpm-workspace.yaml"))
  ? process.cwd()
  : path.resolve(process.cwd(), "../..");
const storage = new LocalStorageProvider(path.resolve(workspaceRoot, process.env.SHORTFACTORY_STORAGE_ROOT ?? "storage"));
const { db, pool } = createDb();

try {
  const identity = createIdentityRepository(db);
  const user = await identity.findUserByEmail(email);
  if (!user) throw new Error(`ユーザーがありません。先にdb:seedを実行してください: ${email}`);
  const [workspace] = await identity.listWorkspaces(user.id);
  if (!workspace) throw new Error("Workspaceがありません。先にdb:seedを実行してください");

  const brandRepository = createBrandRepository(db);
  const assetRepository = createAssetRepository(db);
  const existingBrand = (await brandRepository.listByWorkspace(workspace.id)).find((brand) => brand.name === "デモギフト");
  const brand = existingBrand ?? await brandRepository.create({
    workspaceId: workspace.id,
    kit: { ...giftBrandFixture, name: "デモギフト", voice: { provider: "voicevox", voiceId: "3" } },
  });
  const existingAssets = new Map((await assetRepository.listByBrand(brand.id)).map((asset) => [asset.key, asset]));

  for (const key of DEMO_ASSET_KEYS) {
    const kind = key.includes("/") || key === "gift_girl" ? "character" : ["shop_shelf", "room_warm", "desk"].includes(key) ? "background" : "object";
    const storageKey = `assets/${brand.id}/${key.replace("/", "__")}.svg`;
    await storage.put(storageKey, new TextEncoder().encode(demoSvg(key)), "image/svg+xml");
    if (!existingAssets.has(key)) {
      await assetRepository.create({
        workspaceId: workspace.id,
        brandId: brand.id,
        key,
        kind,
        contentType: "image/svg+xml",
        storageKey,
        source: "Short Factory demo fixture",
        rightsNote: "自動生成のデモ素材。公開・商用利用の素材判定には使わない",
      });
    }
  }

  console.log(`デモブランド: ${brand.name} (${brand.id})`);
  console.log(`デモ素材: ${DEMO_ASSET_KEYS.length}点を登録済み`);
} finally {
  await pool.end();
}

function demoSvg(key: string): string {
  const label = key.replace("/", " ");
  const color = key === "gift_box" ? "#8CC7B8" : key === "cookie" ? "#D9A066" : key === "card" ? "#FFFFFF" : key.includes("smile") ? "#E98F8A" : key.includes("surprise") ? "#F7C66A" : key.includes("think") ? "#F2A7A0" : "#DDEFE8";
  const artwork = ["shop_shelf", "room_warm", "desk"].includes(key)
    ? `<rect width="1080" height="1920" fill="${color}"/><circle cx="540" cy="900" r="420" fill="#ffffff" fill-opacity=".55"/>`
    : key === "gift_girl" || key.startsWith("gift_girl/")
      ? `<rect x="360" y="430" width="360" height="760" rx="180" fill="${color}"/><circle cx="540" cy="360" r="150" fill="#FFE0D2"/>`
      : `<rect x="390" y="700" width="300" height="260" rx="28" fill="${color}" stroke="#4A3B36" stroke-width="12"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">${artwork}<text x="540" y="1280" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#4A3B36">${label}</text></svg>\n`;
}
