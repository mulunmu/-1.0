import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Loader2,
  Mail,
  X,
  Building2,
  MapPin,
  Briefcase,
  Shield,
  AlertTriangle,
} from "lucide-react";
import WarningSignalBadge from "@/components/WarningSignalBadge";
import EnterpriseRadarChart from "@/components/EnterpriseRadarChart";
import EnterpriseDimensionCard from "@/components/EnterpriseDimensionCard";
import EnterpriseSkeleton from "@/components/EnterpriseSkeleton";
import { EmptyBlock, ErrorBlock } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getEnterprise,
  getLegalEvents,
  generateReport,
  downloadReport,
  emailReport,
  type EnterpriseAssessment,
  type LegalEventItem,
} from "@/lib/api";
import { getMockEnterprise } from "@/lib/mockEnterprises";
import {
  CREDIT_LEVEL_COLORS,
  DIMENSION_LABELS,
  DIM_KEYS,
  type DimKey,
  LEGAL_EVENT_LABELS,
  LEGAL_SEVERITY_COLORS,
  RISK_LEVEL_COLORS,
} from "@/lib/labels";
import { CHART_THEME, RISK_CHART_COLORS } from "@/lib/theme";
import { cn } from "@/lib/utils";

/* ──────────────── 辅助函数 ──────────────── */

function formatMoney(v: unknown): string {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)} 万`;
  return n.toLocaleString();
}

/** 从 dimension_details 提取可展示字段 */
function pickDetailFields(
  details: Record<string, Record<string, unknown>>,
  key: string,
): Record<string, unknown> {
  const d = details[key];
  if (!d || typeof d !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === "label" || k === "weight") continue;
    out[k] = v;
  }
  return out;
}

/** 风险等级对应的纯色指示色字符串（用于 style）—— 复用全局 RISK_CHART_COLORS */
function riskScoreColor(level: string): string {
  return RISK_CHART_COLORS[level] ?? RISK_CHART_COLORS["中等风险"];
}

/* ═══════════════════════════════════════════
   主页面组件
   ═══════════════════════════════════════════ */

export default function EnterpriseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<EnterpriseAssessment | null>(() =>
    id ? getMockEnterprise(id) ?? null : null,
  );
  const [legalEvents, setLegalEvents] = useState<LegalEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /* ── 数据加载 ── */

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [ent, events] = await Promise.all([
        getEnterprise(id),
        getLegalEvents(id),
      ]);
      setData(ent);
      setLegalEvents(events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── 报告操作 ── */

  async function handleDownloadReport() {
    if (!data) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const { report_id, status } = await generateReport(data.enterprise_id);
      if (status === "completed") {
        await downloadReport(
          report_id,
          `${data.enterprise_name}_评估报告.pdf`,
        );
      } else {
        throw new Error("报告生成未完成");
      }
    } catch (e) {
      setReportError(
        e instanceof Error ? e.message : "报告下载失败",
      );
    } finally {
      setReportLoading(false);
    }
  }

  async function handleSendEmail() {
    if (!data || !emailAddress.trim()) return;
    setEmailLoading(true);
    setEmailFeedback(null);
    try {
      const res = await emailReport(data.enterprise_id, emailAddress.trim());
      if (res.success) {
        setEmailFeedback({ type: "success", text: "已发送" });
        setTimeout(() => {
          setEmailOpen(false);
          setEmailFeedback(null);
          setEmailAddress("");
        }, 1500);
      } else {
        setEmailFeedback({ type: "error", text: res.message });
      }
    } catch (e) {
      setEmailFeedback({
        type: "error",
        text: e instanceof Error ? e.message : "发送失败",
      });
    } finally {
      setEmailLoading(false);
    }
  }

  /* ── 加载 / 错误 / 空状态 ── */

  if (loading) return <EnterpriseSkeleton />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return <EmptyBlock message="企业不存在" />;

  /* ── 派生数据 ── */

  const details = data.dimension_details as Record<
    string,
    Record<string, unknown>
  >;
  const finDetail = details?.finance ?? {};

  const profileFields: { label: string; value: string }[] = [
    { label: "统一社会信用代码", value: data.enterprise_id },
    { label: "所属行业", value: `${data.industry_l1 ?? "—"} / ${data.industry_l2 ?? "—"}` },
    { label: "所在地区", value: `${data.province ?? "—"} ${data.city ?? ""}`.trim() },
    { label: "信用等级", value: data.credit_level },
    {
      label: "纳税准时率",
      value: `${(data.tax_on_time_rate * 100).toFixed(1)}%`,
    },
    {
      label: "营收偏差",
      value: `${(data.revenue_deviation * 100).toFixed(2)}%`,
    },
    { label: "社保趋势", value: data.social_trend },
    {
      label: "净资产收益率",
      value:
        finDetail.roe != null
          ? `${(Number(finDetail.roe) * 100).toFixed(2)}%`
          : "—",
    },
    {
      label: "资产负债率",
      value:
        finDetail.debt_ratio != null
          ? `${(Number(finDetail.debt_ratio) * 100).toFixed(1)}%`
          : "—",
    },
    {
      label: "Z 值评分",
      value:
        finDetail.z_score != null
          ? Number(finDetail.z_score).toFixed(2)
          : "—",
    },
  ];

  /* 风险标签组 —— 全部复用全局 RISK_LEVEL_COLORS / CREDIT_LEVEL_COLORS / LEGAL_SEVERITY_COLORS */
  const LOW = RISK_LEVEL_COLORS["低风险"];       // 正常 / 安全
  const MID_HIGH = RISK_LEVEL_COLORS["中高风险"]; // 关注 / 偏离
  const HIGH = RISK_LEVEL_COLORS["高风险"];       // 异常 / 预警

  const riskTags: { group: string; tags: { label: string; style: string }[] }[] =
    [
      {
        group: "信用",
        tags: [
          {
            label: `信用 ${data.credit_level}`,
            style:
              CREDIT_LEVEL_COLORS[data.credit_level] ?? CREDIT_LEVEL_COLORS.M,
          },
          ...(data.tax_on_time_rate < 0.8
            ? [{ label: "纳税异常", style: HIGH }]
            : []),
        ],
      },
      {
        group: "司法",
        tags:
          legalEvents.length === 0
            ? [{ label: "无司法事件", style: LOW }]
            : legalEvents.slice(0, 3).map((ev) => ({
                label:
                  LEGAL_EVENT_LABELS[ev.event_type] ?? ev.event_type,
                style:
                  LEGAL_SEVERITY_COLORS[ev.severity] ??
                  LEGAL_SEVERITY_COLORS.L,
              })),
      },
      {
        group: "经营",
        tags: [
          {
            label:
              data.revenue_deviation > 0.3 ? "营收偏差高" : "营收正常",
            style: data.revenue_deviation > 0.3 ? MID_HIGH : LOW,
          },
          {
            label:
              data.social_trend === "缩减" ? "社保缩减" : "社保稳定",
            style: data.social_trend === "缩减" ? MID_HIGH : LOW,
          },
        ],
      },
      {
        group: "涉贷",
        tags: [
          {
            label:
              finDetail.debt_ratio != null &&
              Number(finDetail.debt_ratio) > 0.7
                ? "负债偏高"
                : "负债正常",
            style:
              finDetail.debt_ratio != null &&
              Number(finDetail.debt_ratio) > 0.7
                ? MID_HIGH
                : LOW,
          },
          {
            label:
              finDetail.z_score != null && Number(finDetail.z_score) < 1.8
                ? "Z值预警"
                : "Z值正常",
            style:
              finDetail.z_score != null &&
              Number(finDetail.z_score) < 1.8
                ? HIGH
                : LOW,
          },
        ],
      },
    ];

  const riskColor = riskScoreColor(data.risk_level);

  /* ══════════════════════════════════════
     渲染
     ══════════════════════════════════════ */

  return (
    <div className="w-full space-y-4 sm:space-y-5 fade-in pb-6">
      {/* ═══ 页面头部 ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 shrink-0 hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors duration-200 ease-out"
          >
            <Link to="/dashboard" aria-label="返回工作台">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-neutral-100 truncate">
              {data.enterprise_name}
            </h1>
            <p className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="font-mono">{data.enterprise_id}</span>
              <span className="text-neutral-700">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={10} />
                {data.province} {data.city}
              </span>
              <span className="text-neutral-700">·</span>
              <span className="inline-flex items-center gap-1">
                <Briefcase size={10} />
                {data.industry_l1 ?? "—"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            className={cn(
              "text-xs font-semibold px-3 py-1 rounded-md border",
              RISK_LEVEL_COLORS[data.risk_level] ??
                RISK_LEVEL_COLORS["中等风险"],
            )}
          >
            {data.risk_level}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadReport}
            disabled={reportLoading || emailLoading}
            className="h-8 border-white/[0.1] text-xs gap-1.5 hover:bg-white/[0.06] hover:border-white/[0.18] active:bg-white/[0.1] transition-colors duration-200 ease-out"
          >
            {reportLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            导出
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEmailOpen(true);
              setEmailFeedback(null);
            }}
            disabled={reportLoading || emailLoading}
            className="h-8 border-white/[0.1] text-xs gap-1.5 hover:bg-white/[0.06] hover:border-white/[0.18] active:bg-white/[0.1] transition-colors duration-200 ease-out"
          >
            <Mail className="h-3.5 w-3.5" />
            邮件
          </Button>
        </div>

        {reportError && (
          <p className="text-xs text-rose-400 w-full">{reportError}</p>
        )}
      </div>

      {/* ═══ 核心评分双栏 ═══ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5">
        {/* ── 左栏：总分 + 风险等级 + 雷达图 ── */}
        <Card className="rounded-lg">
          <CardContent className="pt-5 flex flex-col items-center">
            {/* 48px 总分数 */}
            <p
              className="text-[48px] font-bold font-mono tabular-nums leading-none"
              style={{ color: riskColor }}
            >
              {data.overall_score.toFixed(1)}
            </p>

            {/* 风险等级标签 */}
            <Badge
              className={cn(
                "mt-3 mb-5 text-sm font-semibold px-4 py-1 rounded-md border",
                RISK_LEVEL_COLORS[data.risk_level] ??
                  RISK_LEVEL_COLORS["中等风险"],
              )}
            >
              {data.risk_level}
            </Badge>

            {/* 雷达图 */}
            <div className="w-full max-w-[360px] mx-auto">
              <EnterpriseRadarChart data={data} />
            </div>

            {/* 五维得分速览 */}
            <div className="w-full mt-4 pt-4 border-t border-white/[0.06]">
              <div className="grid grid-cols-5 gap-1 text-center">
                {DIM_KEYS.map((k) => (
                  <div key={k} className="px-1">
                    <span className="text-[10px] text-neutral-500 block truncate">
                      {DIMENSION_LABELS[k]}
                    </span>
                    <span className="text-sm font-mono tabular-nums text-neutral-200 mt-0.5 block">
                      {data.dimensions[k].toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 右栏：企业档案 + 预警信号 + 风险标签组 ── */}
        <Card className="rounded-lg">
          <CardContent className="pt-5 space-y-5">
            {/* 预警信号 */}
            {data.warning_signals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span className="text-xs font-medium text-neutral-400 tracking-wide">
                    预警信号
                  </span>
                  <span className="text-[10px] font-mono text-neutral-600">
                    {data.warning_signals.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.warning_signals.map((signal) => (
                    <WarningSignalBadge key={signal} signal={signal} />
                  ))}
                </div>
              </div>
            )}

            {/* 企业档案 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={14} className="text-neutral-500" />
                <span className="text-xs font-medium text-neutral-400 tracking-wide">
                  企业档案
                </span>
              </div>
              <div className="space-y-2">
                {profileFields.slice(0, 8).map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-[11px] text-neutral-500 shrink-0">
                      {f.label}
                    </span>
                    <span className="text-xs text-neutral-200 text-right font-mono tabular-nums truncate">
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 风险标签组 */}
            <div className="space-y-3 pt-1">
              {riskTags.map((group) => (
                <div key={group.group}>
                  <span className="text-[10px] text-neutral-600 tracking-wider uppercase block mb-1.5">
                    {group.group}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((t, i) => (
                      <span
                        key={`${t.label}-${i}`}
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                          t.style,
                        )}
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* AI 分析快捷入口 */}
            <div className="pt-2 border-t border-white/[0.04]">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full border-white/[0.08] text-xs gap-2 hover:bg-white/[0.05] hover:border-white/[0.14] active:bg-white/[0.08] transition-colors duration-200 ease-out"
              >
                <Link
                  to={`/chat?q=${encodeURIComponent(`分析${data.enterprise_name}的综合风险`)}`}
                >
                  <Shield size={14} className="text-blue-400" />
                  智能分析 {data.enterprise_name}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ 归因分析 ═══ */}
      {data.attribution && (
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300">
              归因分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {DIM_KEYS.map((k) => {
                const dim = data.attribution!.dimensions[k];
                if (!dim) return null;
                return (
                  <div
                    key={k}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors duration-200 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-neutral-300">
                        {dim.label}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                        {dim.net_contribution}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dim.positive.map((p, i) => (
                        <p
                          key={`p${i}`}
                          className="text-[11px] text-teal-400/80 truncate"
                        >
                          + {p.item}
                        </p>
                      ))}
                      {dim.negative.map((n, i) => (
                        <p
                          key={`n${i}`}
                          className="text-[11px] text-rose-400/80 truncate"
                        >
                          − {n.item}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 五维指标卡片网格 ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} className="text-neutral-500" />
          <span className="text-xs font-medium text-neutral-400 tracking-wide">
            五维风控评分
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {DIM_KEYS.map((k) => (
            <EnterpriseDimensionCard
              key={k}
              dimKey={k}
              score={data.dimensions[k]}
              label={DIMENSION_LABELS[k]}
              detail={pickDetailFields(details, k)}
              onClick={() =>
                navigate(
                  `/chat?q=${encodeURIComponent(`分析${data.enterprise_name}的${DIMENSION_LABELS[k]}`)}`,
                )
              }
            />
          ))}
        </div>
      </div>

      {/* ═══ 法律事件 ═══ */}
      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-neutral-300">
            法律事件
            <span className="ml-2 text-[11px] font-mono text-neutral-500 font-normal">
              {legalEvents.length} 条
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {legalEvents.length === 0 ? (
            <p className="text-xs text-neutral-600 py-6 text-center">
              暂无法律事件记录
            </p>
          ) : (
            <div className="space-y-1.5">
              {legalEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-white/[0.04] px-4 py-3 transition-colors duration-200 hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-200 truncate">
                      {ev.description}
                    </p>
                    <p className="text-[10px] text-neutral-600 mt-0.5">
                      {ev.event_date ?? "日期不详"} ·{" "}
                      {formatMoney(ev.amount_involved)}
                      {ev.source ? ` · ${ev.source}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                        LEGAL_SEVERITY_COLORS[ev.severity] ??
                          LEGAL_SEVERITY_COLORS.L,
                      )}
                    >
                      {ev.severity}
                    </span>
                    <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-neutral-500">
                      {LEGAL_EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 邮件弹窗 ═══ */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/[0.1] bg-[var(--color-bg-surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-100">
                发送评估报告
              </h3>
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="rounded-md p-1 text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors duration-200 ease-out"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Input
              type="email"
              placeholder="请输入收件邮箱"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              disabled={emailLoading}
            />

            {emailFeedback && (
              <p
                className={cn(
                  "mt-3 text-xs",
                  emailFeedback.type === "success"
                    ? "text-teal-400"
                    : "text-rose-400",
                )}
              >
                {emailFeedback.text}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEmailOpen(false)}
                disabled={emailLoading}
                className="border-white/[0.1] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors duration-200 ease-out"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSendEmail}
                disabled={emailLoading || !emailAddress.trim()}
              >
                {emailLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "发送"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
