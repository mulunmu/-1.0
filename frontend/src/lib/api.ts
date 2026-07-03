import axios, { AxiosError } from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 15000,
  headers: {
    Accept: "application/json; charset=utf-8",
    "Content-Type": "application/json; charset=utf-8",
  },
  responseType: "json",
  responseEncoding: "utf8",
});

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ detail?: string }>) => {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    const message =
      detail ||
      (status === 404 ? "资源不存在" : err.message || "请求失败，请稍后重试");
    return Promise.reject(new ApiError(message, status));
  },
);

export interface EnterpriseDimensions {
  tax_health: number;
  authenticity: number;
  finance: number;
}

export interface EnterpriseAssessment {
  enterprise_id: string;
  enterprise_name: string;
  credit_level: string;
  tax_on_time_rate: number;
  invoice_monthly_avg: number;
  revenue_deviation: number;
  social_trend: string;
  overall_score: number;
  risk_level: string;
  dimensions: EnterpriseDimensions;
  dimension_details: Record<string, unknown>;
  warning_signals: string[];
}

export async function healthCheck(): Promise<{ status: string }> {
  const { data } = await api.get<{ status: string }>("/health");
  return data;
}

export async function getEnterprise(id: string): Promise<EnterpriseAssessment> {
  const { data } = await api.get<EnterpriseAssessment>(`/enterprise/${id}`);
  return data;
}

export async function getEnterprisePK(ids: string[]): Promise<EnterpriseAssessment[]> {
  const { data } = await api.get<EnterpriseAssessment[]>("/enterprise/pk", {
    params: { ids: ids.join(",") },
  });
  return data;
}

export interface RiskWarningItem {
  enterprise_id: string;
  enterprise_name: string;
  risk_level: string;
  overall_score: number;
  warning_signals: string[];
}

export async function getAllEnterprises(): Promise<EnterpriseAssessment[]> {
  return getEnterprisePK([
    "ENT001", "ENT002", "ENT003", "ENT004", "ENT005",
    "ENT006", "ENT007", "ENT008", "ENT009", "ENT010",
  ]);
}

export async function getRiskWarnings(): Promise<RiskWarningItem[]> {
  const { data } = await api.get<RiskWarningItem[]>("/risk/warnings");
  return data;
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
