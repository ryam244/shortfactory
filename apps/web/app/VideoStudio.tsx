"use client";

import { useEffect, useState } from "react";
import type { BrandKit, Scene, VideoPlan } from "@shortfactory/contracts";
import { PreviewPlayer } from "./PreviewPlayer";

type Workspace = { id: string; name: string };
type Brand = { id: string; workspaceId: string; name: string; kitJson: BrandKit };
type Video = { id: string; workspaceId: string; brandId: string; topic: string; version: number; status: string; planJson?: Plan | null };
type Plan = VideoPlan;
type CostSummary = { estimatedJpy: string; costs: Array<{ provider: string; model: string; unit: string; estimatedJpy: string }> };
type RenderJob = { id: string; type: string; status: string; step: string | null; errorCode?: string | null };
type PreviewAsset = { id: string; key: string; kind: string };

export default function VideoStudio() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [topic, setTopic] = useState("");
  const [video, setVideo] = useState<Video | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [previewAssets, setPreviewAssets] = useState<Record<string, string>>({});
  const [previewingScene, setPreviewingScene] = useState<string | null>(null);

  useEffect(() => { void loadOptions(); }, []);
  useEffect(() => { if (brandId) void loadPreviewAssets(brandId); else setPreviewAssets({}); }, [brandId]);
  useEffect(() => {
    if (!video || !renderJob || !['queued', 'running'].includes(renderJob.status)) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/videos/${video.id}/render`);
        if (!response.ok || cancelled) return;
        const body = await response.json() as { jobs: RenderJob[] };
        const current = body.jobs.find((job) => job.id === renderJob.id);
        if (!current || cancelled) return;
        setRenderJob(current);
        if (current.status === 'succeeded') setMessage('MP4の生成が完了しました。完成した動画を再生できます。');
        if (current.status === 'failed') setError('MP4生成に失敗しました。再実行できます。');
      } catch { /* Keep polling after a transient connection failure. */ }
    }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [video?.id, renderJob?.id, renderJob?.status]);

  async function loadOptions() {
    const [workspaceResponse, brandResponse] = await Promise.all([fetch("/api/workspaces"), fetch("/api/brands")]);
    if (!workspaceResponse.ok || !brandResponse.ok) return;
    const workspaceData = await workspaceResponse.json() as { workspaces: Workspace[] };
    const brandData = await brandResponse.json() as { brands: Brand[] };
    setWorkspaces(workspaceData.workspaces); setBrands(brandData.brands);
    const workspace = workspaceData.workspaces[0];
    if (!workspace) return;
    setWorkspaceId(workspace.id);
    const videosResponse = await fetch(`/api/videos?workspaceId=${encodeURIComponent(workspace.id)}`);
    if (!videosResponse.ok) return;
    const videoData = await videosResponse.json() as { videos: Video[] };
    const latestVideo = videoData.videos[0];
    if (!latestVideo) return;
    const latestBrand = brandData.brands.find((brand) => brand.id === latestVideo.brandId && brand.workspaceId === workspace.id);
    if (!latestBrand || !latestVideo.planJson) return;
    setBrandId(latestVideo.brandId);
    setTopic(latestVideo.topic);
    setVideo(latestVideo);
    setPlan(latestVideo.planJson);
    await loadPreviewAssets(latestVideo.brandId);
    const [costsResponse, renderResponse] = await Promise.all([
      fetch(`/api/videos/${latestVideo.id}/costs`),
      fetch(`/api/videos/${latestVideo.id}/render`),
    ]);
    if (costsResponse.ok) setCostSummary(await costsResponse.json() as CostSummary);
    if (renderResponse.ok) {
      const renderData = await renderResponse.json() as { jobs: RenderJob[] };
      const latestRenderJob = renderData.jobs.find((job) => job.type === 'render');
      if (latestRenderJob) setRenderJob(latestRenderJob);
    }
    setMessage("保存済みの最新動画を復元しました。");
  }

  async function loadPreviewAssets(selectedBrandId: string) {
    const response = await fetch(`/api/assets?brandId=${encodeURIComponent(selectedBrandId)}`);
    if (!response.ok) { setPreviewAssets({}); return; }
    const body = await response.json() as { assets: PreviewAsset[] };
    setPreviewAssets(Object.fromEntries(body.assets.map((asset) => [asset.key, `/api/assets/${asset.id}/content`])));
  }

  async function createAndGenerate() {
    setBusy(true); setError(""); setMessage(""); setPlan(null);
    const selectedBrand = brands.find((brand) => brand.id === brandId && brand.workspaceId === workspaceId);
    if (!selectedBrand || !topic.trim()) { setError("Workspace、ブランド、テーマを入力してください。"); setBusy(false); return; }
    const createResponse = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, brandId, topic }) });
    if (!createResponse.ok) { setError("動画レコードを作成できません。"); setBusy(false); return; }
    const created = await createResponse.json() as { video: Video };
    setVideo(created.video);
    const planResponse = await fetch(`/api/videos/${created.video.id}/generate-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestedImages: 0 }) });
    if (!planResponse.ok) {
      const body = await planResponse.json().catch(() => ({})) as { error?: string; maxGeneratedImages?: number };
      setError(body.error === "generation_budget_exceeded" ? `画像生成の上限（${body.maxGeneratedImages}枚）を超えています。` : "台本を生成できません。");
      setBusy(false); return;
    }
    const generated = await planResponse.json() as { video: Video; plan: Plan };
    setVideo(generated.video); setPlan(generated.plan);
    const costsResponse = await fetch(`/api/videos/${generated.video.id}/costs`);
    if (costsResponse.ok) setCostSummary(await costsResponse.json() as CostSummary);
    setMessage("fixture Directorで台本を生成しました。編集して保存できます。"); setBusy(false);
  }

  function updateScene(index: number, field: "narration" | "caption", value: string) {
    if (!plan) return;
    setPlan({ ...plan, scenes: plan.scenes.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, [field]: value } : scene) });
  }

  async function previewVoice(scene: Scene) {
    setError(""); setPreviewingScene(scene.id);
    const response = await fetch("/api/voices/synthesize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: scene.narration, voiceId: "3", videoId: video?.id, sceneId: scene.id, persist: true }) });
    if (!response.ok) { setError("音声を生成できません。VOICEVOX Engineが起動しているか確認してください。"); setPreviewingScene(null); return; }
    const body = await response.json() as { asset?: { id: string }; durationMs?: number };
    if (!body.asset) { setError("生成音声の保存情報を取得できません。"); setPreviewingScene(null); return; }
    setAudioUrls((current) => ({ ...current, [scene.id]: `/api/assets/${body.asset!.id}/content` }));
    if (typeof body.durationMs === "number") setAudioDurations((current) => ({ ...current, [scene.id]: body.durationMs! }));
    setPreviewingScene(null);
  }

  async function savePlan() {
    if (!video || !plan) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/videos/${video.id}/plan`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: video.version, plan }) });
    const body = await response.json().catch(() => ({})) as { video?: Video; error?: string; issues?: Array<{ path: string; message: string }> };
    if (!response.ok) { setError(body.issues?.map((issue) => `${issue.path}: ${issue.message}`).join(" / ") || body.error || "台本を保存できません。"); setBusy(false); return; }
    setVideo(body.video ?? video); setMessage("台本を保存しました。"); setBusy(false);
  }

  async function regenerateScene(scene: Scene) {
    if (!video || !plan) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/videos/${video.id}/scenes/${scene.id}/regenerate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: video.version }) });
    const body = await response.json().catch(() => ({})) as { video?: Video; plan?: Plan; error?: string; currentVersion?: number };
    if (!response.ok) { setError(body.error === "version_conflict" ? `別の更新があります。最新版（version ${body.currentVersion ?? "?"}）を読み直してください。` : "シーンを再生成できません。"); setBusy(false); return; }
    if (body.video && body.plan) { setVideo(body.video); setPlan(body.plan); setMessage(`${scene.id}を再生成しました。`); }
    setBusy(false);
  }

  async function enqueueRender() {
    if (!video) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/videos/${video.id}/render`, { method: "POST" });
    const body = await response.json().catch(() => ({})) as { job?: RenderJob; error?: string };
    if (!response.ok || !body.job) { setError(body.error === "plan_required" ? "先に台本を生成・保存してください。" : "動画生成ジョブを作成できません。"); setBusy(false); return; }
    setRenderJob(body.job); setMessage("動画生成ジョブをキューに追加しました。Workerの完了を待っています。"); setBusy(false);
  }

  async function retryRenderJob() {
    if (!video || !renderJob) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/videos/${video.id}/render/${renderJob.id}/retry`, { method: "POST" });
    const body = await response.json().catch(() => ({})) as { job?: RenderJob; error?: string };
    if (!response.ok || !body.job) { setError(body.error === "job_not_retryable" ? "このジョブは再実行できません。" : "ジョブを再実行できません。"); setBusy(false); return; }
    setRenderJob(body.job); setMessage("動画生成ジョブを再キューしました。"); setBusy(false);
  }

  const visibleBrands = brands.filter((brand) => brand.workspaceId === workspaceId);
  const selectedBrand = brands.find((brand) => brand.id === brandId);
  return <section>
    <h2>動画テスト</h2>
    <label>Workspace<select value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setBrandId(""); }}><option value="">選択してください</option>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>
    <label>ブランド<select value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">選択してください</option>{visibleBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
    <label>テーマ<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="例：春の手土産を選ぶコツ" /></label>
    <button onClick={createAndGenerate} disabled={busy}>{busy ? "処理中…" : "動画を作成して台本生成"}</button>
    {video && <p>動画ID: {video.id} / version: {video.version}</p>}
    {costSummary && <p>見積原価：¥{costSummary.estimatedJpy}（fixtureは実費0円）</p>}
    {renderJob?.status === 'succeeded' && video ? <><h3>完成した動画</h3><video key={`${video.id}-${renderJob.id}`} controls playsInline preload="metadata" src={`/api/videos/${video.id}/output`} style={{ width: '100%', maxWidth: 360, aspectRatio: '9 / 16' }} /><p>素材・音声の出所は、ブランドの素材情報で確認できます。</p></> : plan && selectedBrand && <><h3>動画プレビュー</h3><PreviewPlayer plan={plan} brand={selectedBrand.kitJson} assets={previewAssets} sceneAudio={audioUrls} sceneAudioDurations={audioDurations} /></>}
    {plan && <div><h3>台本編集</h3><label>タイトル<input value={plan.title} onChange={(event) => setPlan({ ...plan, title: event.target.value })} /></label>
      {plan.scenes.map((scene, index) => <fieldset key={scene.id}><legend>{scene.id} ({scene.role})</legend><label>ナレーション<textarea value={scene.narration} onChange={(event) => updateScene(index, "narration", event.target.value)} /></label><button type="button" onClick={() => void regenerateScene(scene)} disabled={busy}>このシーンを再生成</button><button type="button" onClick={() => void previewVoice(scene)} disabled={previewingScene === scene.id || busy}>{previewingScene === scene.id ? "音声生成中…" : "音声を試聴"}</button>{audioUrls[scene.id] && <audio controls src={audioUrls[scene.id]} /> }<label>字幕<input value={scene.caption} onChange={(event) => updateScene(index, "caption", event.target.value)} /></label></fieldset>)}
      <label>CTA<input value={plan.cta} onChange={(event) => setPlan({ ...plan, cta: event.target.value })} /></label><button onClick={savePlan} disabled={busy}>台本を保存</button><button onClick={() => void enqueueRender()} disabled={busy}>MP4生成ジョブを作成</button>{renderJob && <p>Render job: {renderJob.id} / {renderJob.status}{renderJob.status === "failed" && <> / <button type="button" onClick={() => void retryRenderJob()} disabled={busy}>再実行</button></>}{renderJob.status === "succeeded" && <> / <a href={`/api/videos/${video?.id}/output`}>MP4をダウンロード</a></>}</p>}
    </div>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
