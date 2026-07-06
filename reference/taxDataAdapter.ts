/**
 * 税务数据适配层
 *
 * 当真实税务数据（企划书A定义的表结构）导入后，
 * 此模块负责将原始税务数据转换为前端 EnterpriseAssessment 类型。
 *
 * 数据源(企划书A定义的12张表):
 *   syx_enterprise_info     — 企业基础信息(200条)
 *   syx_credit_level        — 年度信用评级(602条)
 *   syx_tax_payment         — 缴税记录(15,328条)
 *   syx_vat_arrears_tax     — 欠税(164条)
 *   syx_tax_illega          — 税务违法(287条)
 *   syx_tax_finance_profit_year  — 利润表(20,885条)
 *   syx_tax_finance_balance_year — 资产负债表(39,251条)
 *   syx_cash_flow           — 现金流量(31,567条)
 *   syx_tax_value_added     — 增值税申报(264,180条)
 *   syx_social_declaration  — 社保申报(26,958条)
 *   syx_corporate_income_year — 企业所得税年报(41,339条)
 *   syx_invoice             — 发票交易(292,765条)
 *   syx_invoice_details     — 发票明细(566,839条)
 *   syx_investor_info       — 投资人信息(283条)
 */

import type { EnterpriseAssessment, EnterpriseDimensions } from "@/lib/api";

/* ── 原始税务数据行类型 ── */

export interface RawEnterpriseInfo {
  enterprise_id: string;
  enterprise_name: string;
  tax_id: string; // 纳税人识别号
  address: string;
  industry_code: string;
  industry_l1?: string;
  industry_l2?: string;
  province?: string;
  city?: string;
  register_capital: number;
  listing_status?: string;
}

export interface RawCreditLevel {
  enterprise_id: string;
  year: number;
  credit_level: "A" | "B" | "C" | "D" | "M";
  credit_score: number;
  deduction_items?: string[];
}

export interface RawTaxPayment {
  enterprise_id: string;
  tax_type: string;
  amount: number;
  payment_date: string;
  is_overdue: boolean;
}

export interface RawTaxFinance {
  enterprise_id: string;
  year: number;
  revenue: number; // 营业收入
  operating_cost: number; // 营业成本
  total_profit: number; // 利润总额
  net_profit: number; // 净利润
}

export interface RawTaxBalance {
  enterprise_id: string;
  year: number;
  total_assets: number;
  total_liabilities: number;
  owner_equity: number;
}

export interface RawVatDeclaration {
  enterprise_id: string;
  year: number;
  month: number;
  sales_amount: number; // 销售额
  input_tax: number; // 进项税额
  tax_payable: number; // 应纳税额
}

export interface RawSocialDeclaration {
  enterprise_id: string;
  year: number;
  month: number;
  insured_count: number; // 参保人数
  contribution_base: number; // 缴费基数
  contribution_amount: number; // 缴费金额
}

export interface RawInvoice {
  invoice_id: string;
  buyer_tax_id: string;
  seller_tax_id: string;
  amount: number;
  tax_rate: number;
  invoice_date: string;
  buyer_enterprise_id?: string; // 映射后的企业ID
  seller_enterprise_id?: string;
}

export interface RawLegalEvent {
  enterprise_id: string;
  event_type: string;
  severity: "H" | "M" | "L";
  amount_involved: number | null;
  event_date: string | null;
  description: string;
  source: string;
}

/* ── 适配函数 ── */

const RISK_LEVEL_MAP: Record<string, string> = {
  A: "低风险",
  B: "中低风险",
  C: "中等风险",
  D: "中高风险",
  M: "高风险",
};

const SCORE_MAP: Record<string, number> = {
  A: 85,
  B: 72,
  C: 58,
  D: 42,
  M: 28,
};

/**
 * 计算三维评分（企划书B定义的三维评估引擎）
 */
function calcDimensions(
  credit: RawCreditLevel | undefined,
  financials: RawTaxFinance | undefined,
  balance: RawTaxBalance | undefined,
  vatRecords: RawVatDeclaration[],
  socialRecords: RawSocialDeclaration[],
  legalEvents: RawLegalEvent[],
): EnterpriseDimensions {
  // ── 税务健康(40%) ──
  let taxHealth = 50;
  if (credit) {
    if (credit.credit_level === "A") taxHealth = 85;
    else if (credit.credit_level === "B") taxHealth = 72;
    else if (credit.credit_level === "C") taxHealth = 58;
    else if (credit.credit_level === "D") taxHealth = 42;
    else taxHealth = 30;
    if (credit.deduction_items && credit.deduction_items.length > 0) {
      taxHealth -= Math.min(credit.deduction_items.length * 3, 20);
    }
  }
  const highSev = legalEvents.filter((e) => e.severity === "H").length;
  taxHealth -= Math.min(highSev * 8, 25);

  // ── 经营真实性(35%) ──
  let authenticity = 65;
  if (financials && financials.revenue > 0) {
    authenticity = 65;
  }
  if (socialRecords.length > 0) {
    const latest = socialRecords.reduce((a, b) => (a.year > b.year || (a.year === b.year && a.month > b.month) ? a : b));
    const prev = socialRecords.reduce((a, b) => (a.year < b.year || (a.year === b.year && a.month < b.month) ? a : b));
    if (latest && prev && prev.insured_count > 0) {
      const trend = (latest.insured_count - prev.insured_count) / prev.insured_count;
      if (trend < -0.1) authenticity -= 10;
      else if (trend > 0.05) authenticity += 5;
    }
  }
  const monthlyVat = vatRecords.length > 0
    ? vatRecords.reduce((sum, r) => sum + r.sales_amount, 0) / vatRecords.length
    : 0;
  if (monthlyVat > 0 && financials && financials.revenue > 0) {
    const deviation = Math.abs(monthlyVat * 12 - financials.revenue) / financials.revenue;
    if (deviation > 0.3) authenticity -= 15;
  }

  // ── 行业财务(25%) ──
  let finance = 55;
  if (financials && balance) {
    if (balance.total_assets > 0) {
      const roe = financials.net_profit / (balance.owner_equity || 1);
      if (roe > 0.15) finance += 15;
      else if (roe > 0.08) finance += 8;
      else if (roe < 0) finance -= 10;
    }
    const debtRatio = balance.total_assets > 0
      ? balance.total_liabilities / balance.total_assets
      : 0;
    if (debtRatio > 0.7) finance -= 12;
    else if (debtRatio < 0.3) finance += 5;
  }

  return {
    tax_health: Math.max(5, Math.min(100, Math.round(taxHealth))),
    authenticity: Math.max(5, Math.min(100, Math.round(authenticity))),
    industry: Math.max(5, Math.min(100, Math.round(finance))),
    legal: Math.max(5, Math.min(100, Math.round(80 - highSev * 10))),
    finance: Math.max(5, Math.min(100, Math.round(finance))),
  };
}

/**
 * 将原始税务数据转换为 EnterpriseAssessment
 *
 * @param info       — 企业基础信息
 * @param credit     — 最新年度信用评级
 * @param financials — 最新年度财务数据(利润表)
 * @param balance    — 最新年度资产负债表
 * @param vatRecords — 增值税申报记录(用于计算月均)
 * @param socialRecords — 社保申报记录(用于计算趋势)
 * @param legalEvents — 法律事件列表
 * @param publicFinancials — 可选: 东方财富公开财务数据(用于交叉验证)
 */
export function adaptTaxDataToEnterprise(
  info: RawEnterpriseInfo,
  credit: RawCreditLevel | undefined,
  financials: RawTaxFinance | undefined,
  balance: RawTaxBalance | undefined,
  vatRecords: RawVatDeclaration[],
  socialRecords: RawSocialDeclaration[],
  legalEvents: RawLegalEvent[],
  publicFinancials?: { revenue: number; net_profit: number; roe: number; debt_ratio: number } | undefined,
): EnterpriseAssessment {
  const dimensions = calcDimensions(credit, financials, balance, vatRecords, socialRecords, legalEvents);

  const overallScore = Math.round(
    dimensions.tax_health * 0.40 +
    dimensions.authenticity * 0.35 +
    (dimensions.industry + dimensions.finance) / 2 * 0.25,
  );

  const riskLevel = credit
    ? (RISK_LEVEL_MAP[credit.credit_level] ?? "中等风险")
    : "中等风险";

  const creditLevel = credit?.credit_level ?? "M";
  const creditScore = credit?.credit_score ?? SCORE_MAP[creditLevel];

  // 计算社保趋势（统一中文枚举：增长/稳定/缩减）
  let socialTrend = "稳定";
  if (socialRecords.length >= 2) {
    const sorted = [...socialRecords].sort((a, b) => a.year - b.year || a.month - b.month);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first.insured_count > 0) {
      const change = (last.insured_count - first.insured_count) / first.insured_count;
      if (change > 0.05) socialTrend = "增长";
      else if (change < -0.1) socialTrend = "缩减";
    }
  }

  // 计算月度平均发票数(简化)
  const monthlyAvg = vatRecords.length > 0
    ? Math.round(vatRecords.length / Math.max(1, Math.ceil(vatRecords.length / 12)))
    : 0;

  // 预警信号(企划书B定义的5个)
  const signals: string[] = [];
  if (credit && credit.credit_level !== "A" && credit.credit_score < 70) {
    signals.push("信用降级");
  }
  if (socialTrend === "缩减") signals.push("社保缩减");
  if (financials && publicFinancials && publicFinancials.revenue > 0) {
    const dev = Math.abs(financials.revenue - publicFinancials.revenue) / publicFinancials.revenue;
    if (dev > 0.3) signals.push("报表偏差");
  }
  if (monthlyAvg < 10) signals.push("发票骤降");
  if (highSevCount(legalEvents) > 0) signals.push("涉诉风险");

  return {
    enterprise_id: info.enterprise_id,
    enterprise_name: info.enterprise_name,
    credit_level: creditLevel,
    tax_on_time_rate: credit ? creditScore / 100 : 0.8,
    invoice_monthly_avg: monthlyAvg,
    revenue_deviation: 0,
    social_trend: socialTrend,
    industry_l1: info.industry_l1 ?? "未知",
    industry_l2: info.industry_l2 ?? undefined,
    province: info.province,
    city: info.city,
    overall_score: overallScore,
    risk_level: riskLevel,
    dimensions,
    dimension_details: {},
    warning_signals: signals,
  };
}

function highSevCount(events: RawLegalEvent[]): number {
  return events.filter((e) => e.severity === "H").length;
}

/**
 * 批量转换: 企业列表 → EnterpriseAssessment 列表
 * 当后端 /api/v1/enterprise/list 返回真实数据后，前端可直用此函数映射
 */
export function batchAdaptTaxData(
  rawData: {
    info: RawEnterpriseInfo;
    credit?: RawCreditLevel;
    financials?: RawTaxFinance;
    balance?: RawTaxBalance;
    vatRecords: RawVatDeclaration[];
    socialRecords: RawSocialDeclaration[];
    legalEvents: RawLegalEvent[];
    publicFinancials?: { revenue: number; net_profit: number; roe: number; debt_ratio: number };
  }[],
): EnterpriseAssessment[] {
  return rawData.map((r) =>
    adaptTaxDataToEnterprise(
      r.info,
      r.credit,
      r.financials,
      r.balance,
      r.vatRecords,
      r.socialRecords,
      r.legalEvents,
      r.publicFinancials,
    ),
  );
}
