import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatReset, formatResetExactTime, formatKstIsoWithoutTimezone } from "./format";

describe("formatReset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T14:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return empty string for invalid ISO dates", () => {
    expect(formatReset("invalid-date")).toBe("");
  });

  it("should return '곧 리셋' when resets_at is in the past or now", () => {
    expect(formatReset("2026-06-10T14:00:00Z")).toBe("곧 리셋");
    expect(formatReset("2026-06-10T13:59:00Z")).toBe("곧 리셋");
  });

  it("should return remaining minutes if less than 1 hour", () => {
    expect(formatReset("2026-06-10T14:35:00Z")).toBe("35분 후 리셋");
  });

  it("should return hours and minutes if less than 24 hours but greater than or equal to 1 hour", () => {
    expect(formatReset("2026-06-10T18:15:00Z")).toBe("4시간 15분 후 리셋");
  });

  it("should return days and hours if 24 hours or more", () => {
    expect(formatReset("2026-06-12T17:00:00Z")).toBe("2일 3시간 후 리셋");
  });
});

describe("formatKstIsoWithoutTimezone", () => {
  it("should return original string for invalid ISO dates", () => {
    expect(formatKstIsoWithoutTimezone("invalid-date")).toBe("invalid-date");
  });

  it("should convert UTC ISO string to KST (UTC+9) without timezone indicator", () => {
    expect(formatKstIsoWithoutTimezone("2026-06-10T14:00:00Z")).toBe("2026-06-10T23:00:00");
  });
});

describe("formatResetExactTime", () => {
  it("should return KST reset time label without timezone indicator", () => {
    expect(formatResetExactTime("2026-06-10T14:00:00Z")).toBe("리셋 시각 2026-06-10T23:00:00");
  });

  it("should return empty string for invalid ISO dates", () => {
    expect(formatResetExactTime("invalid-date")).toBe("");
  });
});
