import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  MANUAL_REFRESH_UNLOCK_SECS,
  MANUAL_REFRESH_SKELETON_MIN_MS,
  MAX_INTERVAL,
  RETRY_BUFFER_SECS,
  RETRY_FALLBACK_SECS,
} from "./config";
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
  canManualRefresh: boolean;
  shouldForceManualRefresh: boolean;
  dismissCooldown: () => void;
  showingManualRefreshSkeleton: boolean;
  refresh: (options?: { force?: boolean; manual?: boolean }) => void;
  intervalOptions: number[];
}

const intervalOptions = Array.from({ length: MAX_INTERVAL }, (_, i) => i + 1);

function retryAfterFromError(message: string): number | null {
  const match = message.match(/(\d+)\s*초/);
  if (!match) return null;

  const seconds = Number(match[1]);
  return seconds > 0 ? seconds : RETRY_FALLBACK_SECS;
}

function normalizeRetryAfterSecs(seconds: number | undefined): number | null {
  if (seconds === undefined) return null;
  return seconds > 0 ? seconds : RETRY_FALLBACK_SECS;
}

export function useClaudeUsage(
  gateway: UsageGateway = tauriUsageGateway,
): ClaudeUsageState {
  const [usage, setUsage] = useState<ClaudeUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [intervalMin, setIntervalMinState] = useState(loadIntervalMin);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownStartedAt, setCooldownStartedAt] = useState(0);
  const [cooldownVisible, setCooldownVisible] = useState(false);
  const [showingManualRefreshSkeleton, setShowingManualRefreshSkeleton] = useState(false);
  const [, forceClockTick] = useState(0);

  const intervalRef = useRef(intervalMin);
  const cooldownUntilRef = useRef(cooldownUntil);
  const refreshRef = useRef<(options?: { force?: boolean; manual?: boolean }) => void>(() => {});
  const timer = useRef<number | null>(null);
  const manualSkeletonTimer = useRef<number | null>(null);

  const schedule = useCallback((secs: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => refreshRef.current(), secs * 1000);
  }, []);

  const startCooldown = useCallback((seconds: number, visible: boolean) => {
    setCooldownStartedAt(Date.now());
    setCooldownUntil(Date.now() + seconds * 1000);
    setCooldownVisible(visible);
  }, []);

  const clearCooldown = useCallback(() => {
    setCooldownStartedAt(0);
    setCooldownUntil(0);
    setCooldownVisible(false);
  }, []);

  const refresh = useCallback(async (options?: { force?: boolean; manual?: boolean }) => {
    const manual = options?.manual === true;
    if (manual) {
      if (manualSkeletonTimer.current !== null) {
        window.clearTimeout(manualSkeletonTimer.current);
      }
      setShowingManualRefreshSkeleton(true);
      manualSkeletonTimer.current = window.setTimeout(() => {
        setShowingManualRefreshSkeleton(false);
        manualSkeletonTimer.current = null;
      }, MANUAL_REFRESH_SKELETON_MIN_MS);
    }

    setLoading(true);
    let nextSecs = intervalRef.current * 60;

    try {
      const nextUsage = await gateway.fetchClaudeUsage({ force: options?.force });
      setUsage(nextUsage);

      const retryAfterSecs = normalizeRetryAfterSecs(nextUsage.retry_after_secs);
      if (retryAfterSecs !== null) {
        setError(null);
        startCooldown(retryAfterSecs, manual);
        nextSecs = retryAfterSecs + RETRY_BUFFER_SECS;
      } else {
        setError(null);
        clearCooldown();
      }
    } catch (e) {
      const message = String(e);
      const retryAfterSecs = retryAfterFromError(message);

      if (retryAfterSecs !== null) {
        setError(null);
        startCooldown(retryAfterSecs, manual);
        nextSecs = retryAfterSecs + RETRY_BUFFER_SECS;
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      schedule(nextSecs);
    }
  }, [clearCooldown, gateway, schedule, startCooldown]);

  const setIntervalMin = useCallback((value: number) => {
    setIntervalMinState(value);
  }, []);

  const dismissCooldown = useCallback(() => {
    setCooldownVisible(false);
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
      if (manualSkeletonTimer.current !== null) {
        window.clearTimeout(manualSkeletonTimer.current);
      }
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
    const id = window.setInterval(() => forceClockTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const internalCooldownLeft = Math.max(
    0,
    Math.ceil((cooldownUntil - Date.now()) / 1000),
  );
  const cooldownElapsedSecs =
    cooldownStartedAt > 0 ? Math.floor((Date.now() - cooldownStartedAt) / 1000) : 0;
  const internalCooling = internalCooldownLeft > 0;
  const cooling = cooldownVisible && internalCooling;
  const cooldownLeft = cooling ? internalCooldownLeft : 0;
  const canManualRefresh =
    !internalCooling || cooldownElapsedSecs >= MANUAL_REFRESH_UNLOCK_SECS;
  const shouldForceManualRefresh = internalCooling && canManualRefresh;

  return {
    usage,
    error,
    loading,
    intervalMin,
    setIntervalMin,
    cooldownLeft,
    cooling,
    canManualRefresh,
    shouldForceManualRefresh,
    dismissCooldown,
    showingManualRefreshSkeleton,
    refresh,
    intervalOptions,
  };
}
