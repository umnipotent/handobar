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
  retry_after_secs?: number;
}

const INTERVAL_KEY = "handobar.intervalMin";
const MIN_INTERVAL = 1;
const MAX_INTERVAL = 10;
/** rate limit 해제 후 살짝 여유를 두고 재시도 */
const RETRY_BUFFER_SECS = 2;

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
  if (h >= 24) return `${Math.floor(h / 24)}일 ${h % 24}시간 후 리셋`;
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
        <div className={`bar-fill ${low ? "low" : ""}`} style={{ width: `${remaining ?? 0}%` }} />
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
  const [cooldownUntil, setCooldownUntil] = useState(0); // ms epoch, 0 = 없음
  const [, force] = useState(0); // 쿨다운 카운트다운 표시용 1초 틱

  const intervalRef = useRef(intervalMin);
  const timer = useRef<number | null>(null);

  const schedule = (secs: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(tick, secs * 1000);
  };

  // 한 번 fetch하고, 응답에 따라 다음 실행을 backoff/주기로 예약한다.
  const tick = async () => {
    setLoading(true);
    let nextSecs = intervalRef.current * 60;
    try {
      const u = await invoke<ClaudeUsage>("get_claude_usage");
      setUsage(u);
      if (u.retry_after_secs && u.retry_after_secs > 0) {
        setError(null);
        setCooldownUntil(Date.now() + u.retry_after_secs * 1000);
        nextSecs = u.retry_after_secs + RETRY_BUFFER_SECS;
      } else {
        setError(null);
        setCooldownUntil(0);
      }
    } catch (e) {
      // 캐시 없는 429 등: 메시지에서 초를 뽑아 backoff
      const msg = String(e);
      setError(msg);
      const m = msg.match(/(\d+)\s*초/);
      if (m) {
        const secs = Number(m[1]);
        setCooldownUntil(Date.now() + secs * 1000);
        nextSecs = secs + RETRY_BUFFER_SECS;
      }
    } finally {
      setLoading(false);
      schedule(nextSecs);
    }
  };

  // 마운트: 첫 fetch + 트레이 새로고침 이벤트 수신
  useEffect(() => {
    tick();
    const unlisten = listen("usage-refresh-requested", () => {
      if (Date.now() >= cooldownUntil) tick();
    });
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 주기 변경 저장 + 즉시 반영(쿨다운 중이 아니면 재예약)
  useEffect(() => {
    intervalRef.current = intervalMin;
    localStorage.setItem(INTERVAL_KEY, String(intervalMin));
    if (Date.now() >= cooldownUntil) schedule(intervalMin * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMin]);

  // 쿨다운 카운트다운 1초 틱
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const cooling = cooldownLeft > 0;

  return (
    <main className="container">
      <header className="top">
        <h1>Claude Code 잔여 사용량</h1>
        {usage?.subscription && <span className="badge">{usage.subscription}</span>}
      </header>

      {error && <p className="error">{error}</p>}
      {cooling && (
        <p className="cooldown">요청 제한 중 · {cooldownLeft}초 후 자동 재시도</p>
      )}

      <WindowCard title="최근 5시간" hint="5h 한도" data={usage?.five_hour ?? null} />
      <WindowCard title="주간" hint="7일 한도" data={usage?.seven_day ?? null} />

      <div className="controls">
        <label>
          갱신 주기
          <select value={intervalMin} onChange={(e) => setIntervalMin(Number(e.target.value))}>
            {Array.from({ length: MAX_INTERVAL }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}분
              </option>
            ))}
          </select>
        </label>
        <button onClick={tick} disabled={loading || cooling}>
          {loading ? "불러오는 중…" : cooling ? `${cooldownLeft}초` : "새로고침"}
        </button>
      </div>
    </main>
  );
}

export default App;
