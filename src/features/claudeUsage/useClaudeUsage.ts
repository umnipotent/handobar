import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { MAX_INTERVAL, RETRY_BUFFER_SECS } from "./config";
import { loadIntervalMin, saveIntervalMin } from "./storage";
import { tauriUsageGateway, type UsageGateway } from "./usageGateway";
import type { ClaudeUsage } from "./types";

interface ClaudeUsageState {
  usage: ClaudeUsage | null;
  error: string | null;
  loading: boolean;
  intervalMin: number;
  setIntervalMin: (value: number) => void;
  cooldownLeft: number;
  cooling: boolean;
  refresh: () => void;
  intervalOptions: number[];
}

const intervalOptions = Array.from({ length: MAX_INTERVAL }, (_, i) => i + 1);

function retryAfterFromError(message: string): number | null {
  const match = message.match(/(\d+)\s*초/);
  return match ? Number(match[1]) : null;
}

export function useClaudeUsage(
  gateway: UsageGateway = tauriUsageGateway,
): ClaudeUsageState {
  const [usage, setUsage] = useState<ClaudeUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [intervalMin, setIntervalMinState] = useState(loadIntervalMin);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [, forceCooldownTick] = useState(0);

  const intervalRef = useRef(intervalMin);
  const cooldownUntilRef = useRef(cooldownUntil);
  const refreshRef = useRef<() => void>(() => {});
  const timer = useRef<number | null>(null);

  const schedule = useCallback((secs: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => refreshRef.current(), secs * 1000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    let nextSecs = intervalRef.current * 60;

    try {
      const nextUsage = await gateway.fetchClaudeUsage();
      setUsage(nextUsage);

      if (nextUsage.retry_after_secs && nextUsage.retry_after_secs > 0) {
        setError(null);
        setCooldownUntil(Date.now() + nextUsage.retry_after_secs * 1000);
        nextSecs = nextUsage.retry_after_secs + RETRY_BUFFER_SECS;
      } else {
        setError(null);
        setCooldownUntil(0);
      }
    } catch (e) {
      const message = String(e);
      const retryAfterSecs = retryAfterFromError(message);

      setError(message);
      if (retryAfterSecs !== null) {
        setCooldownUntil(Date.now() + retryAfterSecs * 1000);
        nextSecs = retryAfterSecs + RETRY_BUFFER_SECS;
      }
    } finally {
      setLoading(false);
      schedule(nextSecs);
    }
  }, [gateway, schedule]);

  const setIntervalMin = useCallback((value: number) => {
    setIntervalMinState(value);
  }, []);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    refresh();

    const unlisten = listen("usage-refresh-requested", () => {
      if (Date.now() >= cooldownUntilRef.current) refresh();
    });

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  useEffect(() => {
    intervalRef.current = intervalMin;
    saveIntervalMin(intervalMin);
    if (Date.now() >= cooldownUntilRef.current) schedule(intervalMin * 60);
  }, [intervalMin, schedule]);

  useEffect(() => {
    cooldownUntilRef.current = cooldownUntil;
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => forceCooldownTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownLeft = Math.max(
    0,
    Math.ceil((cooldownUntil - Date.now()) / 1000),
  );

  return {
    usage,
    error,
    loading,
    intervalMin,
    setIntervalMin,
    cooldownLeft,
    cooling: cooldownLeft > 0,
    refresh,
    intervalOptions,
  };
}
