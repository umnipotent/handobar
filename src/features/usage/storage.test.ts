import { describe, it, expect, beforeEach, vi } from "vitest";
import { clampIntervalMin, loadIntervalMin, saveIntervalMin } from "./storage";
import { DEFAULT_INTERVAL, MAX_INTERVAL, MIN_INTERVAL } from "./config";

const TEST_KEY = "handobar.test.intervalMin";

// Simple localStorage mock for Node.js environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

const mockLocalStorage = new LocalStorageMock();
globalThis.localStorage = mockLocalStorage as unknown as Storage;

describe("clampIntervalMin", () => {
  it("should return DEFAULT_INTERVAL for NaN or non-finite values", () => {
    expect(clampIntervalMin(NaN)).toBe(DEFAULT_INTERVAL);
    expect(clampIntervalMin(Infinity)).toBe(DEFAULT_INTERVAL);
  });

  it("should clamp values within MIN_INTERVAL and MAX_INTERVAL", () => {
    expect(clampIntervalMin(MIN_INTERVAL - 1)).toBe(MIN_INTERVAL);
    expect(clampIntervalMin(MAX_INTERVAL + 5)).toBe(MAX_INTERVAL);
    expect(clampIntervalMin(MIN_INTERVAL + 2)).toBe(MIN_INTERVAL + 2);
  });

  it("should round decimal numbers", () => {
    expect(clampIntervalMin(5.4)).toBe(5);
    expect(clampIntervalMin(5.6)).toBe(6);
  });
});

describe("localStorage operations (per provider key)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should load DEFAULT_INTERVAL if localstorage is empty or invalid", () => {
    expect(loadIntervalMin(TEST_KEY)).toBe(DEFAULT_INTERVAL);

    localStorage.setItem(TEST_KEY, "invalid");
    expect(loadIntervalMin(TEST_KEY)).toBe(DEFAULT_INTERVAL);
  });

  it("should load clamped value if localstorage contains out-of-bound numbers", () => {
    localStorage.setItem(TEST_KEY, String(MIN_INTERVAL - 1));
    expect(loadIntervalMin(TEST_KEY)).toBe(MIN_INTERVAL);

    localStorage.setItem(TEST_KEY, String(MAX_INTERVAL + 1));
    expect(loadIntervalMin(TEST_KEY)).toBe(MAX_INTERVAL);
  });

  it("should save interval clamped to bounds under the given key", () => {
    saveIntervalMin(TEST_KEY, 5);
    expect(localStorage.getItem(TEST_KEY)).toBe("5");

    saveIntervalMin(TEST_KEY, MIN_INTERVAL - 1);
    expect(localStorage.getItem(TEST_KEY)).toBe(String(MIN_INTERVAL));

    saveIntervalMin(TEST_KEY, MAX_INTERVAL + 1);
    expect(localStorage.getItem(TEST_KEY)).toBe(String(MAX_INTERVAL));
  });

  it("should isolate values across different provider keys", () => {
    saveIntervalMin("handobar.claude.intervalMin", 3);
    saveIntervalMin("handobar.codex.intervalMin", 8);
    expect(loadIntervalMin("handobar.claude.intervalMin")).toBe(3);
    expect(loadIntervalMin("handobar.codex.intervalMin")).toBe(8);
  });
});
