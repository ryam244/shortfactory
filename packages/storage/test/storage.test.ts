import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStorageProvider, readLocalMetadata } from "../src/index";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createProvider(): Promise<LocalStorageProvider> {
  const root = await mkdtemp(join(tmpdir(), "shortfactory-storage-"));
  temporaryRoots.push(root);
  return new LocalStorageProvider(root);
}

describe("LocalStorageProvider", () => {
  it("保存・取得・メタデータ・ローカルURL・削除ができる", async () => {
    const provider = await createProvider();
    const body = new TextEncoder().encode("hello");

    await provider.put("audio/scene-01.wav", body, "audio/wav");
    expect(await provider.get("audio/scene-01.wav")).toEqual(body);
    expect(await readLocalMetadata(provider, "audio/scene-01.wav")).toEqual({
      key: "audio/scene-01.wav",
      contentType: "audio/wav",
      size: 5,
    });
    expect(await provider.signedUrl("audio/scene-01.wav", 60)).toMatch(/^file:\/\//);

    await provider.delete("audio/scene-01.wav");
    await expect(provider.get("audio/scene-01.wav")).rejects.toThrow();
  });

  it("ルート外へ出るキーを拒否する", async () => {
    const provider = await createProvider();
    const body = new Uint8Array([1, 2, 3]);

    await expect(provider.put("../outside.bin", body, "application/octet-stream")).rejects.toThrow();
    await expect(provider.get("/absolute.bin")).rejects.toThrow();
    await expect(provider.signedUrl("", 60)).rejects.toThrow();
  });

  it("期限は正の有限値だけを受け付ける", async () => {
    const provider = await createProvider();
    await provider.put("asset.bin", new Uint8Array([1]), "application/octet-stream");

    await expect(provider.signedUrl("asset.bin", 0)).rejects.toThrow();
    await expect(provider.signedUrl("asset.bin", Number.NaN)).rejects.toThrow();
  });
});
