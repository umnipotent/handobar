import { invoke } from "@tauri-apps/api/core";
import { USAGE_COPY } from "./copy";
import type { ProviderGlyph } from "./providerGlyph";

export interface TrayDisplayItem {
  glyph: ProviderGlyph;
  remaining: number | null;
}

// 트레이 합성 캔버스 치수 (@2x — macOS 메뉴바 22pt 기준 44px)
const TRAY_HEIGHT = 44;
const GLYPH_SIZE = 24;
const GLYPH_TEXT_GAP = 6;
const ITEM_GAP = 18;
const TRAY_FONT = "600 28px -apple-system, 'Helvetica Neue', sans-serif";

// 잔여 %를 트레이 표기로 변환 (null이면 빈 값 표기).
export function formatTrayPercent(remaining: number | null): string {
  if (remaining === null) return USAGE_COPY.usage.emptyValue;
  return `${Math.round(remaining)}%`;
}

// 선택된 항목들을 [글리프][%] 가로 나열로 합성한 PNG 바이트. 항목이 없으면 null.
async function renderTrayImage(items: TrayDisplayItem[]): Promise<Uint8Array | null> {
  if (items.length === 0) return null;

  const canvas = document.createElement("canvas");
  const measureCtx = canvas.getContext("2d");
  if (!measureCtx) return null;
  measureCtx.font = TRAY_FONT;
  const itemWidths = items.map(
    (item) =>
      GLYPH_SIZE + GLYPH_TEXT_GAP + Math.ceil(measureCtx.measureText(formatTrayPercent(item.remaining)).width),
  );

  canvas.width = itemWidths.reduce((sum, w) => sum + w, 0) + ITEM_GAP * (items.length - 1);
  canvas.height = TRAY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 템플릿 이미지 규약: 검정 + 알파만 사용 (macOS가 메뉴바 외관에 맞춰 렌더링).
  ctx.font = TRAY_FONT;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";

  let x = 0;
  items.forEach((item, index) => {
    ctx.save();
    ctx.translate(x, (TRAY_HEIGHT - GLYPH_SIZE) / 2);
    ctx.scale(GLYPH_SIZE / 24, GLYPH_SIZE / 24);
    ctx.fill(new Path2D(item.glyph.d));
    ctx.restore();
    ctx.fillText(formatTrayPercent(item.remaining), x + GLYPH_SIZE + GLYPH_TEXT_GAP, TRAY_HEIGHT / 2 + 1);
    x += itemWidths[index] + ITEM_GAP;
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

// 트레이 표시를 갱신한다. 항목이 없으면 기본 템플릿 아이콘으로 복귀(null 전달).
export async function updateTrayDisplay(items: TrayDisplayItem[]): Promise<void> {
  try {
    const png = await renderTrayImage(items);
    await invoke("set_tray_display", { png: png ? Array.from(png) : null });
  } catch {
    // 트레이 갱신 실패는 치명적이지 않으므로 무시한다.
  }
}
