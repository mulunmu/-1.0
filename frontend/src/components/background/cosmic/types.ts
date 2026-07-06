/** 文字占用区（归一化 0–1，原点在左上，与 CSS 一致） */
export interface TextZone {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 排斥强度 0–1 */
  strength?: number;
}

export function textZoneToWorld(
  zone: TextZone,
  viewport: { width: number; height: number },
): { center: [number, number]; half: [number, number]; force: number } {
  const cx = (zone.x + zone.w * 0.5 - 0.5) * viewport.width;
  const cy = (0.5 - (zone.y + zone.h * 0.5)) * viewport.height;
  return {
    center: [cx, cy],
    half: [(zone.w * viewport.width) * 0.5, (zone.h * viewport.height) * 0.5],
    force: (zone.strength ?? 0.55) * Math.min(viewport.width, viewport.height) * 0.12,
  };
}
