import type { EnterpriseAssessment, EnterpriseDimensions, RiskWarningItem } from "@/lib/api";

export interface MockReportItem {
  id: string;
  enterpriseId: string;
  enterpriseName: string;
  riskLevel: string;
  overallScore: number;
  creditLevel: string;
  dimensions: Record<string, number>;
  createdAt: string;
  industry?: string;
  favorited: boolean;
}

const LEGACY: [string, string, string, string, string, string][] = [
  ["ENT001", "深圳明达科技有限公司", "制造业", "电子设备", "广东", "深圳"],
  ["ENT002", "上海恒信贸易集团", "批发零售", "进出口贸易", "上海", "上海"],
  ["ENT003", "北京智云信息技术有限公司", "信息技术", "软件服务", "北京", "北京"],
  ["ENT004", "广州华南制造股份有限公司", "制造业", "机械设备", "广东", "广州"],
  ["ENT005", "杭州绿源新能源科技", "新能源", "光伏组件", "浙江", "杭州"],
  ["ENT006", "成都天府物流有限公司", "交通运输", "供应链物流", "四川", "成都"],
  ["ENT007", "武汉光谷生物医药", "医药", "生物制药", "湖北", "武汉"],
  ["ENT008", "南京金陵建筑工程", "建筑业", "工程建设", "江苏", "南京"],
  ["ENT009", "天津滨海港口服务", "交通运输", "港口服务", "天津", "天津"],
  ["ENT010", "重庆山城餐饮连锁", "餐饮", "连锁餐饮", "重庆", "重庆"],
];

const REGIONS: [string, string][] = [
  ["广东", "深圳"], ["广东", "广州"], ["上海", "上海"], ["北京", "北京"],
  ["浙江", "杭州"], ["江苏", "南京"], ["四川", "成都"], ["湖北", "武汉"],
];

const INDUSTRIES: [string, string][] = [
  ["制造业", "电子设备"], ["信息技术", "软件服务"], ["批发零售", "进出口贸易"],
  ["建筑业", "工程建设"], ["交通运输", "供应链物流"], ["新能源", "光伏组件"],
  ["医药", "生物制药"], ["餐饮", "连锁餐饮"], ["金融", "融资租赁"],
];

const NAME_CORE = ["汇通", "鑫源", "恒达", "博远", "华创", "盛泰", "嘉禾", "新锐", "天成", "宏图"];
const SUFFIXES = ["有限公司", "股份有限公司", "集团有限公司"];

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function riskLevel(score: number): string {
  if (score >= 80) return "低风险";
  if (score >= 65) return "中低风险";
  if (score >= 50) return "中等风险";
  if (score >= 35) return "中高风险";
  return "高风险";
}

function creditLevel(score: number): string {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "M";
}

function segmentScore(idx: number, rng: () => number): number {
  if (idx <= 100) return 55 + rng() * 35;
  if (idx <= 130) return 20 + rng() * 25;
  if (idx <= 150) return 30 + rng() * 20;
  if (idx <= 170) return 75 + rng() * 20;
  if (idx <= 180) return 48 + rng() * 4;
  if (idx <= 190) return 40 + rng() * 55;
  return 50 + rng() * 30;
}

function buildDimensions(score: number, rng: () => number): EnterpriseDimensions {
  const jitter = () => (rng() - 0.5) * 18;
  return {
    tax_health: Math.min(100, Math.max(0, score + jitter())),
    authenticity: Math.min(100, Math.max(0, score + jitter())),
    industry: Math.min(100, Math.max(0, score + jitter())),
    legal: Math.min(100, Math.max(0, score + jitter())),
    finance: Math.min(100, Math.max(0, score + jitter())),
  };
}

function buildOne(idx: number, rng: () => number): EnterpriseAssessment {
  const id = `ENT${String(idx).padStart(3, "0")}`;
  const legacy = LEGACY.find(([eid]) => eid === id);
  const [province, city] = REGIONS[Math.floor(rng() * REGIONS.length)];
  const [industry_l1, industry_l2] = legacy
    ? [legacy[2], legacy[3]]
    : INDUSTRIES[Math.floor(rng() * INDUSTRIES.length)];
  const name = legacy
    ? legacy[1]
    : `${city}${NAME_CORE[Math.floor(rng() * NAME_CORE.length)]}${SUFFIXES[Math.floor(rng() * SUFFIXES.length)]}`;

  const overall = Math.round(segmentScore(idx, rng) * 10) / 10;
  const dimensions = buildDimensions(overall, rng);

  return {
    enterprise_id: id,
    enterprise_name: name,
    credit_level: creditLevel(overall),
    tax_on_time_rate: 0.7 + rng() * 0.28,
    invoice_monthly_avg: Math.floor(50 + rng() * 450),
    revenue_deviation: (rng() - 0.5) * 0.4,
    social_trend: rng() > 0.5 ? "稳定" : "增长",
    industry_l1,
    industry_l2,
    province: legacy?.[4] ?? province,
    city: legacy?.[5] ?? city,
    overall_score: overall,
    risk_level: riskLevel(overall),
    dimensions,
    dimension_details: {},
    warning_signals: overall < 45 ? ["综合评分偏低", "建议关注税务合规"] : [],
  };
}

let cached: EnterpriseAssessment[] | null = null;

export function getMockEnterprises(): EnterpriseAssessment[] {
  if (cached) return cached;
  const rng = mulberry32(42);
  cached = Array.from({ length: 200 }, (_, i) => buildOne(i + 1, rng));
  return cached;
}

export function getMockEnterprise(id: string): EnterpriseAssessment | undefined {
  return getMockEnterprises().find((e) => e.enterprise_id === id);
}

export function getMockEnterprisePK(ids: string[]): EnterpriseAssessment[] {
  const map = new Map(getMockEnterprises().map((e) => [e.enterprise_id, e]));
  return ids.map((id) => map.get(id)).filter(Boolean) as EnterpriseAssessment[];
}

export function getMockRiskWarnings(): RiskWarningItem[] {
  return getMockEnterprises()
    .filter((e) => e.overall_score < 50 || e.warning_signals.length > 0)
    .slice(0, 24)
    .map((e) => ({
      enterprise_id: e.enterprise_id,
      enterprise_name: e.enterprise_name,
      risk_level: e.risk_level,
      overall_score: e.overall_score,
      warning_signals: e.warning_signals.length
        ? e.warning_signals
        : [`${e.risk_level} · 综合分 ${e.overall_score.toFixed(1)}`],
    }));
}

/** 生成模拟报告列表（用于报告中心 mock 回退） */
export function buildMockReports(enterprises: EnterpriseAssessment[]): MockReportItem[] {
  return enterprises.slice(0, 48).map((ent, i) => {
    const daysAgo = Math.floor(Math.random() * 60) + 1;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return {
      id: `RPT-${String(i + 1).padStart(4, "0")}`,
      enterpriseId: ent.enterprise_id,
      enterpriseName: ent.enterprise_name,
      riskLevel: ent.risk_level,
      overallScore: ent.overall_score,
      creditLevel: ent.credit_level,
      dimensions: { ...ent.dimensions },
      createdAt: d.toISOString().split("T")[0],
      industry: ent.industry_l1,
      favorited: i < 5,
    };
  });
}
