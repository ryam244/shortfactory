"use client";

import { useEffect, useState, type FormEvent } from "react";
import BrandSettings from "./BrandSettings";
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
    return <main><h1>Short Factory</h1><p>ログイン中: {session.subject}</p><button onClick={logout}>ログアウト</button><BrandSettings /><VideoStudio /></main>;
  }
  return <main><h1>Short Factory</h1><form onSubmit={login}>
    <label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "確認中…" : "ログイン"}</button>
  </form></main>;
}
