import type { ChatResponse, EnterpriseAssessment } from "@/lib/api";
import {
  getMockEnterprise,
  getMockEnterprisePK,
  getMockEnterprises,
  getMockRiskWarnings,
} from "@/lib/mockEnterprises";

const ALIASES: Record<string, string> = {
  深圳明达: "ENT001",
  明达: "ENT001",
  上海恒信: "ENT002",
  恒信: "ENT002",
  北京智云: "ENT003",
  智云: "ENT003",
  广州华南: "ENT004",
  华南: "ENT004",
  杭州绿源: "ENT005",
  绿源: "ENT005",
  成都天府: "ENT006",
  天府: "ENT006",
  武汉光谷: "ENT007",
  光谷: "ENT007",
  南京金陵: "ENT008",
  金陵: "ENT008",
  天津滨海: "ENT009",
  滨海: "ENT009",
  重庆山城: "ENT010",
  山城: "ENT010",
};

const FULL_NAMES: Record<string, string> = {
  ENT001: "深圳明达科技有限公司",
  ENT002: "上海恒信贸易集团",
  ENT003: "北京智云信息技术有限公司",
  ENT004: "广州华南制造股份有限公司",
  ENT005: "杭州绿源新能源科技",
  ENT006: "成都天府物流有限公司",
  ENT007: "武汉光谷生物医药",
  ENT008: "南京金陵建筑工程",
  ENT009: "天津滨海港口服务",
  ENT010: "重庆山城餐饮连锁",
};

const PREFIX = "[演示数据] ";

function extractEnterpriseIds(query: string): string[] {
  const ids: string[] = [];
  for (const m of query.matchAll(/ENT\d{3}/gi)) {
    const id = m[0].toUpperCase();
    if (!ids.includes(id)) ids.push(id);
  }
  for (const [alias, id] of Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length)) {
    if (query.includes(alias) && !ids.includes(id)) ids.push(id);
  }
  for (const [id, name] of Object.entries(FULL_NAMES)) {
    if (ids.includes(id)) continue;
    if (query.includes(name) || query.includes(name.replace(/有限公司|股份有限公司|集团/g, ""))) {
      ids.push(id);
    }
  }
  return ids;
}

function matchIntent(query: string, entIds: string[]): string {
  const q = query.toLowerCase();
  if (/对比|比较|pk|vs/.test(q) && entIds.length >= 2) return "enterprise_pk";
  if (/排名|同行|行业/.test(q)) return "industry_compare";
  if (/预警|风险|信号/.test(q)) return "risk_warning";
  if (/税务|纳税|信用/.test(q)) return "tax_health";
  if (/真实|营收|发票/.test(q)) return "authenticity";
  if (/报告|下载/.test(q)) return "full_report";
  if (entIds.length >= 1) return "general";
  return "general";
}

function radarChart(ent: EnterpriseAssessment) {
  const d = ent.dimensions;
  return {
    type: "radar" as const,
    data: {
      indicators: [
        { name: "税务健康", max: 100 },
        { name: "经营真实性", max: 100 },
        { name: "行业地位", max: 100 },
        { name: "法律合规", max: 100 },
        { name: "财务健康", max: 100 },
      ],
      values: [d.tax_health, d.authenticity, d.industry, d.legal, d.finance],
      name: ent.enterprise_name,
    },
  };
}

function pkReply(items: EnterpriseAssessment[]): string {
  const [a, b] = items;
  const diff = Math.abs(a.overall_score - b.overall_score).toFixed(1);
  return (
    `${PREFIX}${a.enterprise_name}综合分${a.overall_score}，${b.enterprise_name}综合分${b.overall_score}。` +
    `税务/真实/财务三维对比见柱状图，分差${diff}分。（数据库未连接，使用本地演示数据）`
  );
}

/** 本地演示回复 — DB 不可用时供智能研判使用 */
export function mockChatReply(query: string, sessionId?: string | null): ChatResponse {
  const entIds = extractEnterpriseIds(query);
  const intent = matchIntent(query, entIds);
  const sid = sessionId ?? crypto.randomUUID();

  if (intent === "enterprise_pk") {
    const ids = entIds.slice(0, 2);
    if (ids.length < 2) {
      ids.push("ENT001", "ENT002");
    }
    const comparison = getMockEnterprisePK(ids).sort((a, b) => b.overall_score - a.overall_score);
    return {
      reply: pkReply(comparison),
      intent,
      data: { comparison },
      charts: {
        type: "bar",
        data: {
          labels: comparison.map((c) => c.enterprise_name),
          series: [
            { name: "税务健康", values: comparison.map((c) => c.dimensions.tax_health) },
            { name: "经营真实性", values: comparison.map((c) => c.dimensions.authenticity) },
            { name: "行业地位", values: comparison.map((c) => c.dimensions.industry) },
            { name: "法律合规", values: comparison.map((c) => c.dimensions.legal) },
            { name: "财务健康", values: comparison.map((c) => c.dimensions.finance) },
          ],
        },
      },
      session_id: sid,
      session_note: "演示模式 · 数据库未连接",
    };
  }

  if (intent === "industry_compare") {
    const ranking = [...getMockEnterprises()]
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, 10)
      .map((e, i) => ({
        rank: i + 1,
        enterprise_id: e.enterprise_id,
        enterprise_name: e.enterprise_name,
        overall_score: e.overall_score,
        risk_level: e.risk_level,
        dimensions: e.dimensions,
      }));
    const avg = ranking.reduce((s, r) => s + r.overall_score, 0) / ranking.length;
    return {
      reply:
        `${PREFIX}样本企业共${ranking.length}家，排名第1的是${ranking[0].enterprise_name}（综合分${ranking[0].overall_score}），行业均值${avg.toFixed(1)}分。`,
      intent,
      data: { ranking, avg_score: Math.round(avg * 100) / 100 },
      charts: {
        type: "bar",
        data: {
          labels: ranking.slice(0, 5).map((r) => r.enterprise_name),
          series: [{ name: "综合分", values: ranking.slice(0, 5).map((r) => r.overall_score) }],
        },
      },
      session_id: sid,
      session_note: "演示模式 · 数据库未连接",
    };
  }

  if (intent === "risk_warning") {
    const warnings = getMockRiskWarnings();
    return {
      reply:
        `${PREFIX}共${warnings.length}家企业存在预警信号，包括${warnings
          .slice(0, 3)
          .map((w) => w.enterprise_name)
          .join("、")}等。`,
      intent,
      data: { warnings },
      charts: { type: "warnings", data: warnings },
      session_id: sid,
      session_note: "演示模式 · 数据库未连接",
    };
  }

  const id = entIds[0] ?? "ENT001";
  const ent = getMockEnterprise(id) ?? getMockEnterprises()[0];
  return {
    reply:
      `${PREFIX}${ent.enterprise_name}综合分${ent.overall_score}，风险等级${ent.risk_level}。` +
      `税务健康${ent.dimensions.tax_health.toFixed(1)}分，经营真实性${ent.dimensions.authenticity.toFixed(1)}分。`,
    intent: intent === "tax_health" ? "tax_health" : "general",
    data: {
      enterprise: {
        enterprise_id: ent.enterprise_id,
        enterprise_name: ent.enterprise_name,
        overall_score: ent.overall_score,
        risk_level: ent.risk_level,
        tax_health: ent.dimensions.tax_health,
        authenticity: ent.dimensions.authenticity,
        industry: ent.dimensions.industry,
        legal: ent.dimensions.legal,
        finance: ent.dimensions.finance,
      },
    },
    charts: radarChart(ent),
    session_id: sid,
    session_note: "演示模式 · 数据库未连接",
  };
}
