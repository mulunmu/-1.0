export const RISK_LEVEL_COLORS: Record<string, string> = {
  低风险: "bg-teal-500/10 text-teal-300/90 border-teal-500/25",
  中低风险: "bg-slate-400/10 text-slate-300/90 border-slate-400/25",
  中等风险: "bg-neutral-500/10 text-neutral-300/90 border-neutral-500/25",
  中高风险: "bg-amber-600/10 text-amber-200/80 border-amber-600/25",
  高风险: "bg-rose-400/10 text-rose-300/90 border-rose-400/25",
};

export const RISK_LEVEL_TEXT: Record<string, string> = {
  低风险: "text-teal-300/90",
  中低风险: "text-slate-300/90",
  中等风险: "text-neutral-300/90",
  中高风险: "text-amber-200/80",
  高风险: "text-rose-300/90",
};

export const CREDIT_LEVEL_COLORS: Record<string, string> = {
  A: "bg-teal-500/10 text-teal-300/90 border-teal-500/25",
  B: "bg-slate-400/10 text-slate-300/90 border-slate-400/25",
  C: "bg-amber-600/10 text-amber-200/80 border-amber-600/25",
  D: "bg-rose-400/10 text-rose-300/90 border-rose-400/25",
  M: "bg-neutral-600/10 text-neutral-400 border-neutral-600/25",
};

export const CREDIT_LEVEL_FILTER_OPTIONS = [
  { value: "全部", label: "全部" },
  { value: "A", label: "A 级" },
  { value: "B", label: "B 级" },
  { value: "C", label: "C 级" },
  { value: "D", label: "D 级" },
  { value: "M", label: "M 级" },
] as const;

export const INDUSTRY_FILTER_OPTIONS = [
  { value: "全部", label: "全部行业" },
  { value: "制造业", label: "制造业" },
  { value: "信息技术", label: "信息技术" },
  { value: "批发零售", label: "批发零售" },
  { value: "建筑业", label: "建筑业" },
  { value: "交通运输", label: "交通运输" },
  { value: "新能源", label: "新能源" },
  { value: "医药", label: "医药" },
  { value: "餐饮", label: "餐饮" },
  { value: "金融", label: "金融" },
] as const;

export const WARNING_SIGNAL_LABELS: Record<
  string,
  { label: string; severity: "red" | "yellow" }
> = {
  tax_on_time_rate_low: { label: "纳税准时率低于 80%", severity: "red" },
  invoice_monthly_avg_drop: { label: "发票月均下降超过 50%", severity: "yellow" },
  credit_level_risk: { label: "信用等级 C/D/M", severity: "red" },
  social_trend_shrink: { label: "社保参保趋势缩减", severity: "yellow" },
  revenue_deviation_high: { label: "营收偏差超过 30%", severity: "red" },
  legal_compliance_risk: { label: "法律合规风险", severity: "red" },
  legal_enforcement_risk: { label: "司法执行风险", severity: "red" },
};

export const LEGAL_EVENT_LABELS: Record<string, string> = {
  tax_violation: "税务违法",
  tax_arrears: "欠税",
  dishonesty: "失信被执行",
  execution: "被执行",
  civil_lawsuit: "民事诉讼",
  admin_penalty: "行政处罚",
};

export const LEGAL_SEVERITY_COLORS: Record<string, string> = {
  L: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  M: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  H: "bg-red-500/15 text-red-400 border-red-500/30",
};

export const WARNING_SEVERITY_STYLES = {
  red: "bg-rose-400/10 text-rose-300/90 border-rose-400/25",
  yellow: "bg-amber-600/10 text-amber-200/80 border-amber-600/25",
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
  authenticity: "经营真实性",
  industry: "行业地位",
  legal: "法律合规",
  finance: "财务健康",
} as const;

export const DIMENSION_WEIGHTS: Record<keyof typeof DIMENSION_LABELS, string> = {
  tax_health: "25%",
  authenticity: "25%",
  industry: "20%",
  legal: "15%",
  finance: "15%",
};

export const DIM_KEYS = ["tax_health", "authenticity", "industry", "legal", "finance"] as const;
export type DimKey = (typeof DIM_KEYS)[number];
