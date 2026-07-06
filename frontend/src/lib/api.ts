import api, { ApiError } from "@/lib/apiClient";
import {
  getMockEnterprise,
  getMockEnterprisePK,
} from "@/lib/mockEnterprises";
import {
  fetchEnterprises,
  fetchEnterprisePK,
  fetchRiskWarnings,
} from "@/lib/dataSource";

export { ApiError };

export interface EnterpriseDimensions {
  tax_health: number;
  authenticity: number;
  industry: number;
  legal: number;
  finance: number;
}

export interface AttributionItem {
  item: string;
  contribution?: number;
  deduction?: number;
  count?: number;
}

export interface DimensionAttribution {
  score: number;
  weight: number;
  label: string;
  positive: AttributionItem[];
  negative: AttributionItem[];
  net_contribution: number;
}

export interface EnterpriseAttribution {
  dimensions: Record<string, DimensionAttribution>;
  summary: string;
}

export interface EnterpriseAssessment {
  enterprise_id: string;
  enterprise_name: string;
  credit_level: string;
  tax_on_time_rate: number;
  invoice_monthly_avg: number;
  revenue_deviation: number;
  social_trend: string;
  industry_l1?: string;
  industry_l2?: string;
  province?: string;
  city?: string;
  overall_score: number;
  risk_level: string;
  dimensions: EnterpriseDimensions;
  dimension_details: Record<string, unknown>;
  attribution?: EnterpriseAttribution;
  warning_signals: string[];
  /** 搜索用拼音首字母（registry 注入或前端计算） */
  initials?: string;
}

export interface LegalEventItem {
  id: number;
  enterprise_id: string;
  event_type: string;
  severity: string;
  amount_involved: number;
  event_date: string | null;
  description: string;
  source: string;
}

export interface HealthResponse {
  status: string;
  database?: string;
  enterprise_count?: number;
  llm_configured?: boolean;
  mock_data?: boolean;
}

export async function healthCheck(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>("/health");
  return data;
}

export async function getEnterprise(id: string): Promise<EnterpriseAssessment> {
  try {
    const { data } = await api.get<EnterpriseAssessment>(`/enterprise/${id}`);
    return data;
  } catch {
    const mock = getMockEnterprise(id);
    if (mock) return mock;
    throw new ApiError("企业不存在");
  }
}

export async function getEnterprisePK(ids: string[]): Promise<EnterpriseAssessment[]> {
  try {
    return await fetchEnterprisePK(ids);
  } catch {
    return getMockEnterprisePK(ids);
  }
}

export async function getAllEnterprises(): Promise<EnterpriseAssessment[]> {
  return fetchEnterprises();
}

export interface InvoiceEdge {
  source_id: string;
  target_id: string;
  amount: number;
  invoice_type?: string;
  invoice_date?: string;
}

export async function getInvoiceEdges(): Promise<InvoiceEdge[]> {
  const { data } = await api.get<InvoiceEdge[]>("/network/invoice-edges");
  return data;
}

export interface RiskWarningItem {
  enterprise_id: string;
  enterprise_name: string;
  risk_level: string;
  overall_score: number;
  warning_signals: string[];
}

export async function getRiskWarnings(): Promise<RiskWarningItem[]> {
  return fetchRiskWarnings();
}

export async function getLegalEvents(enterpriseId: string): Promise<LegalEventItem[]> {
  try {
    const { data } = await api.get<LegalEventItem[]>(`/enterprise/${enterpriseId}/legal-events`, {
      timeout: 2500,
    });
    return data;
  } catch {
    return [];
  }
}

export interface ReportGenerateResponse {
  report_id: string;
  status: string;
}

export async function generateReport(enterpriseId: string): Promise<ReportGenerateResponse> {
  const { data } = await api.post<ReportGenerateResponse>(
    "/report/generate",
    { enterprise_id: enterpriseId },
    { timeout: 60000 },
  );
  return data;
}

export async function downloadReport(reportId: string, filename: string): Promise<void> {
  const { data } = await api.get<Blob>(`/report/${reportId}/download`, {
    responseType: "blob",
    timeout: 60000,
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface EmailReportResponse {
  success: boolean;
  message: string;
}

export interface ChatRadarData {
  indicators: Array<{ name: string; max: number }>;
  values: number[];
  name: string;
}

export interface ChatBarData {
  labels: string[];
  series: Array<{ name: string; values: number[] }>;
}

export interface ChatWarningItem {
  enterprise_name: string;
  risk_level: string;
  warning_signals: string[];
  signal_labels?: string[];
}

export type ChatCharts =
  | { type: "radar"; data: ChatRadarData }
  | { type: "bar"; data: ChatBarData }
  | { type: "warnings"; data: ChatWarningItem[] };

export interface ChatResponse {
  reply: string;
  intent: string;
  data: Record<string, unknown>;
  charts: ChatCharts | null;
  session_id?: string | null;
  session_note?: string;
}

export async function sendChat(query: string, sessionId?: string): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>(
    "/chat",
    { query, session_id: sessionId },
    { timeout: 60000 },
  );
  const reply = typeof data.reply === "string" ? data.reply.trim() : "";
  return { ...data, reply: reply || "暂无文字回复，请查看下方图表与数据详情。" };
}

export async function emailReport(
  enterpriseId: string,
  recipient: string,
): Promise<EmailReportResponse> {
  const { data } = await api.post<EmailReportResponse>(
    "/report/email",
    { enterprise_id: enterpriseId, recipient },
    { timeout: 90000 },
  );
  return data;
}

export default api;
