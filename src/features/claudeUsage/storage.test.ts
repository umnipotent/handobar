import { describe, it, expect, beforeEach, vi } from "vitest";
import { clampIntervalMin, loadIntervalMin, saveIntervalMin } from "./storage";
import { DEFAULT_INTERVAL, INTERVAL_KEY, MAX_INTERVAL, MIN_INTERVAL } from "./config";

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

describe("localStorage operations", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should load DEFAULT_INTERVAL if localstorage is empty or invalid", () => {
    expect(loadIntervalMin()).toBe(DEFAULT_INTERVAL);

    localStorage.setItem(INTERVAL_KEY, "invalid");
    expect(loadIntervalMin()).toBe(DEFAULT_INTERVAL);
  });

  it("should load clamped value if localstorage contains out-of-bound numbers", () => {
    localStorage.setItem(INTERVAL_KEY, String(MIN_INTERVAL - 1));
    expect(loadIntervalMin()).toBe(MIN_INTERVAL);

    localStorage.setItem(INTERVAL_KEY, String(MAX_INTERVAL + 1));
    expect(loadIntervalMin()).toBe(MAX_INTERVAL);
  });

  it("should save interval clamped to bounds", () => {
    saveIntervalMin(5);
    expect(localStorage.getItem(INTERVAL_KEY)).toBe("5");

    saveIntervalMin(MIN_INTERVAL - 1);
    expect(localStorage.getItem(INTERVAL_KEY)).toBe(String(MIN_INTERVAL));

    saveIntervalMin(MAX_INTERVAL + 1);
    expect(localStorage.getItem(INTERVAL_KEY)).toBe(String(MAX_INTERVAL));
  });
});
