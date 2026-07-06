import { ROUTES } from "@/lib/routes";
import type { CelestialCluster } from "@/components/background/cosmic/planetGeometry";

export interface SolarModule {
  id: string;
  label: string;
  shortLabel: string;
  hint: string;
  path: string;
  orbitRadius: number;
  period: number;
  /** 轨道标识 — 交互隐喻，非真实天体 */
  orbitTag: string;
  color: string;
  /** 星尘粒子簇配色 */
  celestial: CelestialCluster;
}

export const SOLAR_MODULES: SolarModule[] = [
  {
    id: "dashboard",
    label: "风控总览",
    shortLabel: "总览",
    hint: "态势监控 · KPI 与风险分布",
    path: ROUTES.dashboard,
    orbitRadius: 302,
    period: 64,
    orbitTag: "内轨",
    color: "#a8c4e8",
    celestial: {
      primary: "#d8e8ff",
      secondary: "#6a8ab8",
      accent: "#eef4ff",
      coreCount: 220,
      coreRadius: 0.36,
    },
  },
  {
    id: "enterprise",
    label: "企业画像",
    shortLabel: "企业",
    hint: "深度评估 · 企业检索与画像",
    path: ROUTES.enterprises,
    orbitRadius: 378,
    period: 64,
    orbitTag: "近轨",
    color: "#c4a8f0",
    celestial: {
      primary: "#e0d0ff",
      secondary: "#8868c8",
      accent: "#f0e8ff",
      coreCount: 250,
      coreRadius: 0.42,
    },
  },
  {
    id: "network",
    label: "交易网络",
    shortLabel: "网络",
    hint: "关系图谱 · 关联交易穿透",
    path: ROUTES.network,
    orbitRadius: 454,
    period: 64,
    orbitTag: "中轨",
    color: "#68d0ff",
    celestial: {
      primary: "#b8ecff",
      secondary: "#3898d8",
      accent: "#e0f8ff",
      coreCount: 280,
      coreRadius: 0.46,
    },
  },
  {
    id: "chat",
    label: "智能研判",
    shortLabel: "研判",
    hint: "风险研判 · 查询与对比",
    path: ROUTES.chat,
    orbitRadius: 530,
    period: 64,
    orbitTag: "远轨",
    color: "#f090a8",
    celestial: {
      primary: "#ffc8d8",
      secondary: "#c84878",
      accent: "#ffe0ec",
      coreCount: 260,
      coreRadius: 0.44,
    },
  },
  {
    id: "reports",
    label: "报告中心",
    shortLabel: "报告",
    hint: "评估归档 · 导出与收藏",
    path: ROUTES.reports,
    orbitRadius: 606,
    period: 64,
    orbitTag: "外轨",
    color: "#e8c878",
    celestial: {
      primary: "#ffe8c0",
      secondary: "#c89848",
      accent: "#fff4e0",
      coreCount: 340,
      coreRadius: 0.56,
    },
  },
];

export function getSolarModuleById(id: string): SolarModule | undefined {
  return SOLAR_MODULES.find((m) => m.id === id);
}

export function resolveSolarModuleId(pathname: string): string {
  if (pathname.startsWith(ROUTES.enterprises) || pathname.startsWith("/enterprise/")) {
    return "enterprise";
  }
  if (pathname.startsWith(ROUTES.network)) return "network";
  if (pathname.startsWith(ROUTES.chat)) return "chat";
  if (pathname.startsWith(ROUTES.reports)) return "reports";
  if (pathname === ROUTES.dashboard || pathname.startsWith("/search") || pathname.startsWith("/pk")) {
    return "dashboard";
  }
  return "dashboard";
}
