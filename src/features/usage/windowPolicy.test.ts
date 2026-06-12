import { describe, expect, it } from "vitest";
import { resolveWindow } from "./windowPolicy";
import type { UsageWindow } from "./types";

describe("resolveWindow", () => {
  it("keeps null windows empty when meaning is unknown", () => {
    expect(resolveWindow(null, true, "unknown")).toBeNull();
  });

  it("maps null windows to exhausted (0%) for providers that record null as exhausted", () => {
    expect(resolveWindow(null, true, "exhausted")).toEqual({
      remaining: 0,
      used: 100,
      resets_at: "",
    });
  });

  it("maps null windows to fresh (100%) for providers where null means no active window", () => {
    expect(resolveWindow(null, true, "fresh")).toEqual({
      remaining: 100,
      used: 0,
      resets_at: "",
    });
  });

  it("keeps loading state null before usage exists", () => {
    expect(resolveWindow(undefined, false, "fresh")).toBeNull();
    expect(resolveWindow(undefined, false, "exhausted")).toBeNull();
  });

  it("passes through existing windows", () => {
    const window: UsageWindow = {
      remaining: 64,
      used: 36,
      resets_at: "2026-06-11T05:00:00Z",
    };

    expect(resolveWindow(window, true, "exhausted")).toBe(window);
  });
});