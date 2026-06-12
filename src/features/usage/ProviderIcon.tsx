import type { ProviderGlyph } from "./providerGlyph";

// 패널 헤더 등에서 쓰는 provider 글리프 아이콘 (fill, currentColor).
export function ProviderIcon({
  glyph,
  size = 16,
  className,
}: {
  glyph: ProviderGlyph;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d={glyph.d} />
    </svg>
  );
}
