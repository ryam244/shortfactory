"use client";

import { useEffect, useState } from "react";

type Workspace = { id: string; name: string };
type Brand = { id: string; workspaceId: string; name: string };
type Video = { id: string; topic: string; status: string; version: number };

const statusLabel: Record<string, string> = {
  draft: "下書き",
  rendering: "生成中",
  ready: "完成",
  failed: "失敗",
};

export default function DashboardOverview() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [brandCount, setBrandCount] = useState(0);
  const [workspaceName, setWorkspaceName] = useState("制作環境");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [workspaceResponse, brandResponse] = await Promise.all([fetch("/api/workspaces"), fetch("/api/brands")]);
        if (!workspaceResponse.ok || !brandResponse.ok) return;
        const workspaceData = await workspaceResponse.json() as { workspaces: Workspace[] };
        const brandData = await brandResponse.json() as { brands: Brand[] };
        const workspace = workspaceData.workspaces[0];
        if (!workspace) return;
        const videoResponse = await fetch(`/api/videos?workspaceId=${encodeURIComponent(workspace.id)}`);
        const videoData = videoResponse.ok ? await videoResponse.json() as { videos: Video[] } : { videos: [] };
        if (cancelled) return;
        setWorkspaceName(workspace.name);
        setBrandCount(brandData.brands.filter((brand) => brand.workspaceId === workspace.id).length);
        setVideos(videoData.videos);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const latest = videos[0];
  return <>
    <section className="metric-grid" aria-label="制作状況">
      <article className="metric-card"><span className="metric-label">制作動画</span><strong>{loading ? "—" : videos.length}</strong><span className="metric-note">{workspaceName}</span></article>
      <article className="metric-card"><span className="metric-label">ブランド</span><strong>{loading ? "—" : brandCount}</strong><span className="metric-note">IPと素材の管理</span></article>
      <article className="metric-card"><span className="metric-label">IPトーン</span><strong>3種類</strong><span className="metric-note">選択して保存済み</span></article>
      <article className="metric-card"><span className="metric-label">最新動画</span><strong>{loading ? "—" : latest ? statusLabel[latest.status] ?? latest.status : "未作成"}</strong><span className="metric-note">{latest ? `v${latest.version}` : "まず1本作成"}</span></article>
    </section>
    <section className="panel recent-panel" aria-label="最近の動画">
      <div className="panel-heading"><div><h2>最近の動画</h2><p>このWorkspaceの制作履歴です。</p></div><a href="#studio">＋ 新しく作る</a></div>
      {loading ? <p>読み込み中…</p> : videos.length === 0 ? <p>まだ動画がありません。最初の1本を作りましょう。</p> : <div className="recent-list">{videos.slice(0, 5).map((video) => <div className="recent-row" key={video.id}><div><strong>{video.topic}</strong><span>version {video.version}</span></div><span className={`status-pill status-${video.status}`}>{statusLabel[video.status] ?? video.status}</span></div>)}</div>}
    </section>
    <section className="panel progress-panel" aria-label="プロジェクト進行状況">
      <div className="panel-heading"><div><h2>プロジェクト進行状況</h2><p>マスタープランに沿った現在地です。</p></div><span className="progress-phase">Phase 0a</span></div>
      <div className="phase-track" aria-hidden="true"><span className="is-complete" /><span className="is-active" /><span /><span /><span /></div>
      <div className="progress-summary"><div><strong>品質検証</strong><span>実素材1本の技術検証まで完了</span></div><div><strong>次にやること</strong><span>冒頭違いを含む実素材5本を評価</span></div></div>
      <a className="progress-link" href="#studio">動画スタジオで評価用の動画を作る →</a>
    </section>
  </>;
}
