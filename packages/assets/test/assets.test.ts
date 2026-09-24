import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalAssetProvider } from "../src/index";

describe("LocalAssetProvider", () => {
  it("resolves registered files as data URLs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "shortfactory-assets-"));
    await mkdir(path.join(root, "characters"));
    await writeFile(path.join(root, "characters", "girl.svg"), "<svg />", "utf8");

    const provider = new LocalAssetProvider(root, {
      "gift_girl/smile": { path: "characters/girl.svg", contentType: "image/svg+xml" },
    });
    const assets = await provider.resolve(["gift_girl/smile"]);

    expect(assets["gift_girl/smile"]).toBe(`data:image/svg+xml;base64,${Buffer.from("<svg />").toString("base64")}`);
  });

  it("rejects missing keys and traversal paths", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "shortfactory-assets-"));
    const provider = new LocalAssetProvider(root, {
      bad: { path: "../outside.svg", contentType: "image/svg+xml" },
    });

    await expect(provider.resolve(["missing"])).rejects.toThrow("asset is not registered");
    await expect(provider.resolve(["bad"])).rejects.toThrow("escapes the asset root");
  });
});
