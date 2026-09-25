"use client";

import { useEffect, useState, type FormEvent } from "react";
import BrandSettings from "./BrandSettings";
import DashboardOverview from "./DashboardOverview";
import VideoStudio from "./VideoStudio";

type Session = { authenticated: boolean; subject?: string };

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void refreshSession(); }, []);

  async function refreshSession() {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    setSession(await response.json() as Session);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      setPassword("");
      await refreshSession();
    } else {
      const body = await response.json().catch(() => ({})) as { error?: string };
      setError(body.error === "auth_unavailable" ? "認証サービスに接続できません。" : "メールアドレスまたはパスワードが違います。");
    }
    setBusy(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshSession();
  }

  if (session?.authenticated) {
    return <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark">S</div><div><strong>Short Factory</strong><small>creative studio</small></div></div>
        <nav className="side-nav" aria-label="メインナビゲーション">
          <a className="active" href="#overview"><span>⌂</span><span>概要</span></a>
          <a href="#studio"><span>✦</span><span>動画スタジオ</span></a>
          <a href="#assets"><span>▦</span><span>素材・ブランド</span></a>
        </nav>
        <div className="sidebar-footer"><strong>{session.subject}</strong><span>ローカル制作環境</span><button onClick={logout}>ログアウト</button></div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar" id="overview"><div><p className="eyebrow">Creative dashboard</p><h1>おかえりなさい</h1><p>ひとつのIPを育てながら、次のショート動画をつくりましょう。</p></div><div className="topbar-actions"><a className="primary-button" href="#studio">＋ 動画をつくる</a></div></header>
        <DashboardOverview />
        <div className="content-grid">
          <section className="panel section-anchor" id="studio"><div className="panel-heading"><div><h2>動画スタジオ</h2><p>訴求ブリーフから台本・音声・MP4まで進めます。</p></div><span aria-hidden="true">●</span></div><VideoStudio /></section>
          <aside>
            <section className="panel section-anchor" id="assets"><div className="panel-heading"><div><h2>ブランドと素材</h2><p>IPの見た目と権利情報を管理します。</p></div><span aria-hidden="true">✦</span></div><BrandSettings /></section>
            <section className="panel"><div className="panel-heading"><div><h3>制作の流れ</h3><p>迷ったらこの順番で進めます。</p></div></div><ol><li>トーンと素材を選ぶ</li><li>5項目の訴求を入力</li><li>台本を確認・修正</li><li>プレビューしてMP4生成</li></ol></section>
          </aside>
        </div>
      </main>
    </div>;
  }
  return <main className="auth-page"><div className="auth-card"><div className="brand-lockup"><div className="brand-mark">S</div><div><strong>Short Factory</strong><small>creative studio</small></div></div><h1>動画制作を、もっと軽く。</h1><p>IPのトーンを守りながら、ショート動画を組み立てます。</p><form onSubmit={login}>
    <label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "確認中…" : "ログイン"}</button>
  </form></div></main>;
}
