"use client";

import { useEffect, useState, type FormEvent } from "react";

type Workspace = { id: string; name: string };
type Brand = { id: string; workspaceId: string; name: string };
type Asset = { id: string; key: string; kind: string; contentType: string; source: string; rightsNote: string };

const initialForm = {
  name: "", style: "淡い手描き風", tone: "親しみやすく短く", cta: "保存してあとで見返してね",
  background: "#fffaf2", primary: "#6b5b95", accent: "#f28c8c", text: "#2f2f2f", captionBackground: "#ffffff",
  voiceProvider: "voicevox", voiceId: "3", captionMaxChars: "24", maxGeneratedImages: "0",
};

export default function BrandSettings() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [assetBrandId, setAssetBrandId] = useState("");
  const [assetKey, setAssetKey] = useState("");
  const [assetKind, setAssetKind] = useState("background");
  const [assetSource, setAssetSource] = useState("");
  const [assetRightsNote, setAssetRightsNote] = useState("");
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetKindFilter, setAssetKindFilter] = useState("all");

  useEffect(() => { void load(); }, []);

  async function load() {
    const [workspaceResponse, brandResponse] = await Promise.all([fetch("/api/workspaces"), fetch("/api/brands")]);
    if (!workspaceResponse.ok || !brandResponse.ok) { setError("Workspace情報を読み込めません。"); return; }
    const workspaceData = await workspaceResponse.json() as { workspaces: Workspace[] };
    const brandData = await brandResponse.json() as { brands: Brand[] };
    setWorkspaces(workspaceData.workspaces); setBrands(brandData.brands);
    if (!workspaceId && workspaceData.workspaces[0]) setWorkspaceId(workspaceData.workspaces[0].id);
    if (!assetBrandId && brandData.brands[0]) setAssetBrandId(brandData.brands[0].id);
  }

  useEffect(() => { if (assetBrandId) void loadAssets(assetBrandId); }, [assetBrandId]);

  async function loadAssets(brandId: string) {
    const response = await fetch(`/api/assets?brandId=${encodeURIComponent(brandId)}`);
    if (response.ok) setAssets((await response.json() as { assets: Asset[] }).assets);
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const response = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: workspaceName }) });
    if (!response.ok) { setError("Workspaceを作成できません。"); return; }
    setWorkspaceName(""); setMessage("Workspaceを作成しました。"); await load();
  }

  async function createBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (!workspaceId) { setError("先にWorkspaceを作成してください。"); return; }
    const kit = {
      name: form.name, style: form.style, tone: form.tone, cta: form.cta,
      colors: { background: form.background, primary: form.primary, accent: form.accent, text: form.text, captionBackground: form.captionBackground },
      font: "zen_maru_gothic", bannedWords: [], readingDict: {}, captionMaxChars: Number(form.captionMaxChars),
      voice: { provider: form.voiceProvider, voiceId: form.voiceId }, budget: { maxGeneratedImages: Number(form.maxGeneratedImages) },
    };
    const response = await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, kit }) });
    if (!response.ok) { setError("ブランド設定を保存できません。入力内容を確認してください。"); return; }
    setMessage("ブランドを登録しました。"); setForm(initialForm); await load();
  }

  async function uploadAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (!workspaceId || !assetBrandId || !assetFile) { setError("Workspace、ブランド、ファイルを指定してください。"); return; }
    const body = new FormData();
    body.set("workspaceId", workspaceId); body.set("brandId", assetBrandId); body.set("key", assetKey);
    body.set("kind", assetKind); body.set("source", assetSource); body.set("rightsNote", assetRightsNote); body.set("file", assetFile);
    const response = await fetch("/api/assets/upload", { method: "POST", body });
    if (!response.ok) { setError("素材を登録できません。キー・権利情報・ファイル形式を確認してください。"); return; }
    setMessage("素材を登録しました。"); setAssetKey(""); setAssetSource(""); setAssetRightsNote(""); setAssetFile(null);
    await loadAssets(assetBrandId);
  }

  const assetKinds = [...new Set(assets.map((asset) => asset.kind))].sort();
  const visibleAssets = assets.filter((asset) => {
    const query = assetQuery.trim().toLowerCase();
    const matchesQuery = !query || [asset.key, asset.source, asset.rightsNote, asset.contentType].some((value) => value.toLowerCase().includes(query));
    return matchesQuery && (assetKindFilter === "all" || asset.kind === assetKindFilter);
  });

  return <section>
    <h2>Workspace</h2>
    <form onSubmit={createWorkspace}><input aria-label="Workspace名" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="例：自社SNS" required /><button>作成</button></form>
    <label>登録先Workspace<select value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setAssetBrandId(""); }}><option value="">選択してください</option>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>
    <h2>ブランド登録</h2>
    <form onSubmit={createBrand}>
      <label>ブランド名<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
      <label>スタイル<input value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })} required /></label>
      <label>文体<input value={form.tone} onChange={(event) => setForm({ ...form, tone: event.target.value })} required /></label>
      <label>CTA<input value={form.cta} onChange={(event) => setForm({ ...form, cta: event.target.value })} required /></label>
      <label>音声<select value={form.voiceProvider} onChange={(event) => setForm({ ...form, voiceProvider: event.target.value })}><option value="voicevox">VOICEVOX</option><option value="gemini">Gemini</option><option value="elevenlabs">ElevenLabs</option></select></label>
      <label>音声ID<input value={form.voiceId} onChange={(event) => setForm({ ...form, voiceId: event.target.value })} required /></label>
      <label>1本あたり画像生成上限<input type="number" min="0" max="3" value={form.maxGeneratedImages} onChange={(event) => setForm({ ...form, maxGeneratedImages: event.target.value })} /></label>
      <button type="submit">ブランドを保存</button>
    </form>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <h2>登録済みブランド</h2><ul>{brands.map((brand) => <li key={brand.id}>{brand.name}</li>)}</ul>
    <h2>素材登録</h2>
    <form onSubmit={uploadAsset}>
      <label>ブランド<select value={assetBrandId} onChange={(event) => setAssetBrandId(event.target.value)}><option value="">選択してください</option>{brands.filter((brand) => brand.workspaceId === workspaceId).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
      <label>素材キー<input value={assetKey} onChange={(event) => setAssetKey(event.target.value)} placeholder="character_01" required pattern="[a-z0-9][a-z0-9_]*" /></label>
      <label>種類<input value={assetKind} onChange={(event) => setAssetKind(event.target.value)} required /></label>
      <label>出所<input value={assetSource} onChange={(event) => setAssetSource(event.target.value)} placeholder="自作、購入元URLなど" required /></label>
      <label>利用権情報<input value={assetRightsNote} onChange={(event) => setAssetRightsNote(event.target.value)} placeholder="商用利用可、ライセンス名など" required /></label>
      <label>ファイル<input type="file" accept="image/*,audio/*,video/*" onChange={(event) => setAssetFile(event.target.files?.[0] ?? null)} required /></label>
      <button type="submit">素材を登録</button>
    </form>
    {assets.length > 0 && <>
      <h3>登録済み素材</h3>
      <label>素材検索<input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="キー、出所、権利情報、MIMEタイプ" /></label>
      <label>種類<select value={assetKindFilter} onChange={(event) => setAssetKindFilter(event.target.value)}><option value="all">すべて</option>{assetKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
      {visibleAssets.length === 0 ? <p role="status">条件に一致する素材はありません。</p> : <ul>{visibleAssets.map((asset) => <li key={asset.id}>
        <a href={`/api/assets/${asset.id}/content`} target="_blank" rel="noreferrer">{asset.key}</a>
        <span>（{asset.kind} / {asset.contentType}）</span>
        <details><summary>出所・利用権情報</summary><p>出所：{asset.source}</p><p>利用権：{asset.rightsNote}</p></details>
      </li>)}</ul>}
    </>}
  </section>;
}
