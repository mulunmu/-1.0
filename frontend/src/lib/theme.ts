/** 星空主题 — 语义色 + 图表/ECharts 配置（冷灰基调 + 低饱和语义色） */
import type { CSSProperties } from "react";

/** 风险等级：冷青 → 中性灰 → 暖琥珀 → 柔玫瑰（同一亮度带，避免彩虹感） */
export const RISK_CHART_COLORS: Record<string, string> = {
  低风险: "#6eb5a8",
  中低风险: "#8fa3b8",
  中等风险: "#9ca3af",
  中高风险: "#c4a06a",
  高风险: "#c97b8e",
};

export const RISK_CHART_GLOW: Record<string, string> = {
  低风险: "rgba(110,181,168,0.35)",
  中低风险: "rgba(143,163,184,0.35)",
  中等风险: "rgba(156,163,175,0.3)",
  中高风险: "rgba(196,160,106,0.4)",
  高风险: "rgba(201,123,142,0.45)",
};

export const RISK_LEVEL_ORDER = ["高风险", "中高风险", "中等风险", "中低风险", "低风险"] as const;

export const DIMENSION_CHART_COLORS = {
  tax_health: "#5ec4d4",
  authenticity: "#9ca8c4",
  finance: "#6eb5a8",
} as const;

export const CREDIT_CHART_COLORS: Record<string, { color: string; bg: string }> = {
  A: { color: "#6eb5a8", bg: "rgba(110,181,168,0.1)" },
  B: { color: "#8fa3b8", bg: "rgba(143,163,184,0.1)" },
  C: { color: "#c4a06a", bg: "rgba(196,160,106,0.1)" },
  D: { color: "#c97b8e", bg: "rgba(201,123,142,0.1)" },
  M: { color: "#737373", bg: "rgba(115,115,115,0.1)" },
};

/** 指标卡：主色统一冷白/青，仅风险类带暖色点缀 */
export const STAT_ACCENT_COLORS = {
  total: { icon: "#a3a3a3", value: "#f5f5f5" },
  highRisk: { icon: "#c97b8e", value: "#e8c4cc" },
  warnings: { icon: "#c4a06a", value: "#ddd0b0" },
  average: { icon: "#5ec4d4", value: "#b8e8ef" },
} as const;

export const CHART_THEME = {
  axisLabel: "#737373",
  axisLine: "rgba(255,255,255,0.08)",
  splitLine: "rgba(255,255,255,0.05)",
  splitArea: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.01)"] as [string, string],
  tooltip: {
    backgroundColor: "rgba(22,22,22,0.92)",
    borderColor: "rgba(255,255,255,0.1)",
    textStyle: { color: "#d4d4d4", fontSize: 12 },
  },
  radar: {
    line: "#8fa3b8",
    area: "rgba(143,163,184,0.18)",
    item: "#cbd5e1",
  },
  heatmap: ["#1a1a1a", "#2a3038", "#3d4a56", "#5a6b7a", "#8fa3b8"],
  dimensionBars: [
    DIMENSION_CHART_COLORS.tax_health,
    DIMENSION_CHART_COLORS.authenticity,
    "#9ca3af",
    "#c97b8e",
    DIMENSION_CHART_COLORS.finance,
  ],
};

export function riskScoreColor(level: string): string {
  return RISK_CHART_COLORS[level] ?? "#d4d4d4";
}

export function riskGlowStyle(level: string): CSSProperties {
  const c = riskScoreColor(level);
  const glow = RISK_CHART_GLOW[level] ?? "rgba(212,212,212,0.25)";
  return {
    color: c,
    textShadow: `0 0 18px ${glow}`,
  };
}
