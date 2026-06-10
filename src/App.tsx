import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

interface UsageWindow {
  remaining: number;
  used: number;
  resets_at: string;
}

interface ClaudeUsage {
  five_hour: UsageWindow | null;
  seven_day: UsageWindow | null;
  subscription: string | null;
  fetched_at: string;
}

const INTERVAL_KEY = "handobar.intervalMin";
const MIN_INTERVAL = 1;
const MAX_INTERVAL = 10;

function loadInterval(): number {
  const raw = Number(localStorage.getItem(INTERVAL_KEY));
  if (!Number.isFinite(raw)) return 5;
  return Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(raw)));
}

function formatReset(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "곧 리셋";
  const mins = Math.floor(diffMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}일 ${h % 24}시간 후 리셋`;
  }
  return h > 0 ? `${h}시간 ${m}분 후 리셋` : `${m}분 후 리셋`;
}

function WindowCard({ title, hint, data }: { title: string; hint: string; data: UsageWindow | null }) {
  const remaining = data ? Math.round(data.remaining) : null;
  const low = remaining !== null && remaining <= 15;
  return (
    <section className="card">
      <div className="card-head">
        <span className="title">{title}</span>
        <span className="hint">{hint}</span>
      </div>
      <div className={`remaining ${low ? "low" : ""}`}>
        {remaining !== null ? `${remaining}%` : "—"}
        <span className="remaining-label">잔여</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${remaining ?? 0}%` }} />
      </div>
      <div className="reset">{data ? formatReset(data.resets_at) : ""}</div>
    </section>
  );
}

function App() {
  const [usage, setUsage] = useState<ClaudeUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [intervalMin, setIntervalMin] = useState<number>(loadInterval);
  const timer = useRef<number | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setUsage(await invoke<ClaudeUsage>("get_claude_usage"));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // 트레이의 새로고침 이벤트 수신 (한 번만 등록)
  useEffect(() => {
    refresh();
    const unlisten = listen("usage-refresh-requested", refresh);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // 주기 변경 시 폴링 타이머 재설정 + 저장
  useEffect(() => {
    localStorage.setItem(INTERVAL_KEY, String(intervalMin));
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = window.setInterval(refresh, intervalMin * 60_000);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [intervalMin]);

  return (
    <main className="container">
      <header className="top">
        <h1>Claude Code 잔여 사용량</h1>
        {usage?.subscription && <span className="badge">{usage.subscription}</span>}
      </header>

      {error && <p className="error">{error}</p>}

      <WindowCard title="최근 5시간" hint="5h 한도" data={usage?.five_hour ?? null} />
      <WindowCard title="주간" hint="7일 한도" data={usage?.seven_day ?? null} />

      <div className="controls">
        <label>
          갱신 주기
          <select
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
          >
            {Array.from({ length: MAX_INTERVAL }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}분
              </option>
            ))}
          </select>
        </label>
        <button onClick={refresh} disabled={loading}>
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>
    </main>
  );
}

export default App;
