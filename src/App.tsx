import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

interface UsageWindow {
  tokens: number;
  messages: number;
}

interface ClaudeUsage {
  five_hour: UsageWindow;
  weekly: UsageWindow;
  updated_at: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString();
}

function Window({ title, hint, data }: { title: string; hint: string; data?: UsageWindow }) {
  return (
    <section className="card">
      <div className="card-head">
        <span className="title">{title}</span>
        <span className="hint">{hint}</span>
      </div>
      <div className="tokens">{data ? formatTokens(data.tokens) : "—"}</div>
      <div className="label">tokens · {data ? data.messages : 0} messages</div>
    </section>
  );
}

function App() {
  const [usage, setUsage] = useState<ClaudeUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshUsage = async () => {
    try {
      setUsage(await invoke<ClaudeUsage>("get_claude_usage"));
      setError(null);
    } catch (e) {
      console.error(e);
      setError("사용량을 불러오지 못했습니다");
    }
  };

  useEffect(() => {
    refreshUsage();
    const unlisten = listen("usage-refresh-requested", refreshUsage);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <main className="container">
      <h1>Claude Code 사용량</h1>

      {error && <p className="error">{error}</p>}

      <Window title="최근 5시간" hint="rolling 5h" data={usage?.five_hour} />
      <Window title="주간" hint="rolling 7d" data={usage?.weekly} />

      <footer>
        <span className="updated">
          {usage ? `갱신: ${formatTime(usage.updated_at)}` : "불러오는 중…"}
        </span>
        <button onClick={refreshUsage}>새로고침</button>
      </footer>
    </main>
  );
}

export default App;
