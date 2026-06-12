import { describe, expect, it } from "vitest";
import { formatTrayPercent } from "./trayDisplay";

describe("formatTrayPercent", () => {
  it("null이면 빈 값 표기를 쓴다", () => {
    expect(formatTrayPercent(null)).toBe("—");
  });

  it("정수로 반올림해 %를 붙인다", () => {
    expect(formatTrayPercent(72.4)).toBe("72%");
    expect(formatTrayPercent(0)).toBe("0%");
    expect(formatTrayPercent(100)).toBe("100%");
  });
});
