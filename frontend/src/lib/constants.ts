export const ENTERPRISE_IDS = [
  "ENT001",
  "ENT002",
  "ENT003",
  "ENT004",
  "ENT005",
  "ENT006",
  "ENT007",
  "ENT008",
  "ENT009",
  "ENT010",
] as const;

export const ALL_ENTERPRISE_IDS = ENTERPRISE_IDS.join(",");

/** 种子企业名称 — 用于快捷操作和示例按钮 */
export const SEED_ENTERPRISE_A = "深圳明达科技";
export const SEED_ENTERPRISE_B = "上海恒信贸易集团";
export const SEED_ENTERPRISE_C = "杭州绿源新能源科技";

/** 种子企业ID快捷引用 */
export const SEED_ID_A = "ENT001";
export const SEED_ID_B = "ENT002";
export const SEED_ID_C = "ENT005";

/** 快捷对话查询模板 */
export const QUICK_COMPARE_QUERY = `对比${SEED_ENTERPRISE_A}和${SEED_ENTERPRISE_B}`;
export const QUICK_ANALYZE_QUERY = `分析${SEED_ENTERPRISE_A}的税务健康`;
export const QUICK_WARNINGS_QUERY = "有哪些风险预警";
export const QUICK_RANKING_QUERY = "样本企业行业排名";
