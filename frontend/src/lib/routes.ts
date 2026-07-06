import { QUICK_COMPARE_QUERY, QUICK_WARNINGS_QUERY } from "@/lib/constants";

/** 方案 C — 路由常量 */

export const ROUTES = {
  login: "/login",
  register: "/register",
  hub: "/hub",
  dashboard: "/dashboard",
  enterprises: "/enterprises",
  chat: "/chat",
  network: "/network",
  reports: "/reports",
  enterprise: (id: string) => `/enterprise/${id}`,
} as const;

export const CHAT_QUERIES = {
  search: "搜索企业",
  warnings: QUICK_WARNINGS_QUERY,
  compareDefault: QUICK_COMPARE_QUERY,
  compareIds: (ids: string[]) => `对比企业 ${ids.join(" ")}`,
} as const;

export function chatUrl(query: string): string {
  return `${ROUTES.chat}?q=${encodeURIComponent(query)}`;
}

export type NavItemId = "hub" | "dashboard" | "chat" | "network" | "reports";

export interface NavItemConfig {
  id: NavItemId;
  path: string;
  label: string;
  hint: string;
}

/** 侧栏导航 — 纯平面图标列表 */
export const NAV_ITEMS: NavItemConfig[] = [
  { id: "hub", path: ROUTES.hub, label: "透镜", hint: "功能入口" },
  { id: "dashboard", path: ROUTES.dashboard, label: "工作台", hint: "态势总览" },
  { id: "chat", path: ROUTES.chat, label: "智能研判", hint: "查询 · 对比" },
  { id: "network", path: ROUTES.network, label: "交易网络", hint: "关系图谱" },
  { id: "reports", path: ROUTES.reports, label: "报告中心", hint: "导出归档" },
];
