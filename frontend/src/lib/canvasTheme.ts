/**
 * Canvas 2D 渲染色值常量 — NetworkGraph 图谱专用
 * 所有 Canvas fillStyle/strokeStyle 必须引用此处常量，禁止页面内硬编码 rgba/hex
 */
import { RISK_CHART_COLORS } from "@/lib/theme";

/** 画布背景色（匹配 --color-bg-elevated） */
export const CANVAS_BG = "#0c0c0e";

/** 中心节点填充色（匹配 --color-fg） */
export const CANVAS_CENTER_FILL = "#fafafa";

/** 风险等级 RGB 映射（从 RISK_CHART_COLORS hex 解析） */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export const NODE_RISK_RGB: Record<string, [number, number, number]> = {
  低风险: hexToRgb(RISK_CHART_COLORS["低风险"]),
  中低风险: hexToRgb(RISK_CHART_COLORS["中低风险"]),
  中等风险: hexToRgb(RISK_CHART_COLORS["中等风险"]),
  中高风险: hexToRgb(RISK_CHART_COLORS["中高风险"]),
  高风险: hexToRgb(RISK_CHART_COLORS["高风险"]),
};

/** 预览星团连线透明度 */
export const PREVIEW_LINK_ALPHA = { inner: 0.07, cross: 0.05 } as const;

/** 子图连线风险色阶 */
export function linkRiskRgb(aRisk: string, bRisk: string): [number, number, number] {
  if (aRisk === "高风险" || bRisk === "高风险") return NODE_RISK_RGB["高风险"];
  if (aRisk === "中高风险" || bRisk === "中高风险") return NODE_RISK_RGB["中高风险"];
  return [161, 161, 170]; // neutral fallback
}

/** 选中/悬停环颜色 */
export const HOVER_RING_COLOR = "rgba(255,255,255,0.5)";

/** 节点边框透明度 */
export const NODE_BORDER_ALPHA = 0.15;

/** 中心节点边框 */
export const CENTER_BORDER_COLOR = "rgba(255,255,255,0.3)";

/** 标签文字色 */
export const LABEL_COLOR = (alpha: number) => `rgba(255,255,255,${alpha})`;

/** 星团标签色 */
export const CLUSTER_LABEL_COLOR = "rgba(161,161,170,0.65)";

/* ── Canvas rgba 构造辅助函数（封装所有动态 rgba 模板，页面禁止裸写） ── */

/** RGB 数组 → rgba 字符串 */
export function rgbFill(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** 白色系透明度快捷构造 */
export function whiteAlpha(alpha: number): string {
  return `rgba(255,255,255,${alpha})`;
}

/** 预览连线颜色 */
export function previewLinkColor(alpha: number, type: "inner" | "cross"): string {
  return whiteAlpha(PREVIEW_LINK_ALPHA[type] * alpha);
}
