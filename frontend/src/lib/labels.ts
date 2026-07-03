export const RISK_LEVEL_COLORS: Record<string, string> = {
  低风险: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  中低风险: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  中等风险: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  中高风险: "bg-red-500/20 text-red-400 border-red-500/40",
  高风险: "bg-red-900/40 text-red-300 border-red-700/50",
};

export const RISK_LEVEL_TEXT: Record<string, string> = {
  低风险: "text-emerald-400",
  中低风险: "text-blue-400",
  中等风险: "text-amber-400",
  中高风险: "text-red-400",
  高风险: "text-red-300",
};

export const CREDIT_LEVEL_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  C: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  D: "bg-red-500/20 text-red-400 border-red-500/40",
  M: "bg-slate-500/20 text-slate-400 border-slate-500/40",
};

export const WARNING_SIGNAL_LABELS: Record<
  string,
  { label: string; severity: "red" | "yellow" }
> = {
  tax_on_time_rate_low: { label: "纳税准时率低于 80%", severity: "red" },
  invoice_monthly_avg_drop: { label: "发票月均下降超过 50%", severity: "yellow" },
  credit_level_risk: { label: "信用等级 C/D/M", severity: "red" },
  social_trend_shrink: { label: "社保参保趋势缩减", severity: "yellow" },
  revenue_deviation_high: { label: "营收偏差超过 30%", severity: "red" },
};

export const WARNING_SEVERITY_STYLES = {
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export const RISK_LEVEL_FILTER_OPTIONS = [
  { value: "全部", label: "全部" },
  { value: "高风险", label: "高风险" },
  { value: "中高风险", label: "中高风险" },
  { value: "中等风险", label: "中等风险" },
  { value: "中低风险", label: "中低风险" },
  { value: "低风险", label: "低风险" },
] as const;

export const DIMENSION_LABELS = {
  tax_health: "税务健康",
  authenticity: "真实性",
  finance: "财务健康",
} as const;
