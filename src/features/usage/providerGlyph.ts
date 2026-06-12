// provider별 글리프(24x24 박스 기준 fill path — simple-icons 형식). 패널 헤더 아이콘과 트레이 합성이 공유한다.
export interface ProviderGlyph {
  /** 24x24 viewBox 기준 fill path (currentColor로 채움) */
  d: string;
}
