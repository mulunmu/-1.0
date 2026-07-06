import api from "@/lib/apiClient";
import {
  getMockEnterprisePK,
  getMockEnterprises,
  getMockRiskWarnings,
} from "@/lib/mockEnterprises";
import { mockChatReply } from "@/lib/mockChat";
import type { EnterpriseAssessment, RiskWarningItem, ChatResponse } from "@/lib/api";

export type DataMode = "mock" | "mock_with_llm" | "live";

interface HealthResponse {
  status: string;
  database?: string;
  enterprise_count?: number;
  llm_configured?: boolean;
  data_mode?: string;
}

let resolvedMode: DataMode = "mock";
let modePromise: Promise<DataMode> | null = null;

async function healthCheckFast(): Promise<HealthResponse | null> {
  try {
    const { data } = await api.get<HealthResponse>("/health", { timeout: 1500 });
    return data;
  } catch {
    return null;
  }
}

/** 探测后端是否可用（带 1.5s 超时，避免阻塞页面） */
export async function resolveDataMode(): Promise<DataMode> {
  if (modePromise) return modePromise;

  modePromise = (async () => {
    const health = await healthCheckFast();
    if (
      health?.database === "connected" &&
      (health.enterprise_count ?? 0) > 0
    ) {
      resolvedMode = "live";
    } else if (health?.llm_configured) {
      resolvedMode = "mock_with_llm";
    } else {
      resolvedMode = "mock";
    }
    return resolvedMode;
  })();

  return modePromise;
}

export function getDataModeSync(): DataMode {
  return resolvedMode;
}

/** 是否应该调用真实 API（live 或 mock_with_llm 都调用，仅纯 mock 不调用） */
export function shouldUseRealApi(): boolean {
  return resolvedMode === "live" || resolvedMode === "mock_with_llm";
}

/** 同步获取演示数据 — 页面首屏立即可用 */
export function getInstantEnterprises(): EnterpriseAssessment[] {
  return getMockEnterprises();
}

export function getInstantRiskWarnings(): RiskWarningItem[] {
  return getMockRiskWarnings();
}

const LIST_TIMEOUT_MS = 2500;

/** 拉取企业列表：兼容分页和非分页响应 */
export async function fetchEnterprises(): Promise<EnterpriseAssessment[]> {
  const mock = getMockEnterprises();
  const mode = await resolveDataMode();
  if (mode === "mock") return mock;

  try {
    const { data } = await api.get<{ items?: EnterpriseAssessment[] } | EnterpriseAssessment[]>("/enterprise/list", {
      params: { page_size: 200 },
      timeout: LIST_TIMEOUT_MS,
    });
    // 兼容分页 { items, total, page } 和直接数组两种响应
    const items = Array.isArray(data) ? data : (data as { items?: EnterpriseAssessment[] })?.items;
    if (Array.isArray(items) && items.length > 0) {
      resolvedMode = "live";
      return items;
    }
  } catch {
    // API 调用失败时返回 fallback 数据，但不改变已确定的数据模式
  }
  return mock;
}

export async function fetchEnterprisePK(ids: string[]): Promise<EnterpriseAssessment[]> {
  if (!ids.length) return [];
  const mode = getDataModeSync();
  if (mode === "mock") return getMockEnterprisePK(ids);

  try {
    const { data } = await api.get<EnterpriseAssessment[]>("/enterprise/pk", {
      params: { ids: ids.join(",") },
      timeout: LIST_TIMEOUT_MS,
    });
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {
    /* fallthrough */
  }
  return getMockEnterprisePK(ids);
}

export async function fetchRiskWarnings(): Promise<RiskWarningItem[]> {
  const mock = getMockRiskWarnings();
  const mode = await resolveDataMode();
  if (mode === "mock") return mock;

  try {
    const { data } = await api.get<RiskWarningItem[]>("/risk/warnings", {
      timeout: LIST_TIMEOUT_MS,
    });
    if (Array.isArray(data)) return data;
  } catch {
    // API 不可用时返回 mock 数据，不改变已确定的数据模式
  }
  return mock;
}

const CHAT_TIMEOUT_MS = 8000;

/** 智能研判 — 纯 mock 模式用本地模板，mock_with_llm/live 调真实 API（含 LLM） */
export async function sendChatMessage(
  query: string,
  sessionId?: string,
): Promise<ChatResponse> {
  const mode = await resolveDataMode();
  if (mode === "mock") {
    return mockChatReply(query, sessionId);
  }

  try {
    const { data } = await api.post<ChatResponse>(
      "/chat",
      { query, session_id: sessionId },
      { timeout: CHAT_TIMEOUT_MS },
    );
    const reply = typeof data.reply === "string" ? data.reply.trim() : "";
    return { ...data, reply: reply || "暂无文字回复，请查看下方图表与数据详情。" };
  } catch {
    // API 不可用时返回本地模板回复，不改变数据模式
    return mockChatReply(query, sessionId);
  }
}
