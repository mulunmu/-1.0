import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as echarts from "echarts";
import { ArrowLeft, Download, Loader2, Mail, X } from "lucide-react";
import LineSigil from "@/components/LineSigil";
import WarningSignalBadge from "@/components/WarningSignalBadge";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateViews";
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
import {
  CREDIT_LEVEL_COLORS,
  DIMENSION_LABELS,
  DIM_KEYS,
  LEGAL_EVENT_LABELS,
  LEGAL_SEVERITY_COLORS,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_TEXT,
} from "@/lib/labels";
import { CHART_THEME } from "@/lib/theme";

function RadarChart({ data }: { data: EnterpriseAssessment }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current ??= echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    const chart = instanceRef.current;

    chart.setOption({
      backgroundColor: "transparent",
      radar: {
        indicator: DIM_KEYS.map((k) => ({
          name: DIMENSION_LABELS[k],
          max: 100,
        })),
        center: ["50%", "55%"],
        radius: "62%",
        axisName: { color: CHART_THEME.axisLabel, fontSize: 11 },
        splitLine: { lineStyle: { color: CHART_THEME.splitLine } },
        splitArea: { areaStyle: { color: CHART_THEME.splitArea } },
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
      },
      series: [{
        type: "radar",
        data: [{
          value: DIM_KEYS.map((k) => data.dimensions[k]),
          name: data.enterprise_name,
          areaStyle: { color: CHART_THEME.radar.area },
          lineStyle: { color: CHART_THEME.radar.line, width: 2 },
          itemStyle: { color: CHART_THEME.radar.item },
        }],
      }],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [data]);

  useEffect(() => () => { instanceRef.current?.dispose(); instanceRef.current = null; }, []);

  return <div ref={chartRef} className="h-72 w-full sm:h-80" />;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-3">
      <p className="text-[10px] text-neutral-600">{label}</p>
      <p className="mt-1 text-sm font-mono text-neutral-200 truncate">{value}</p>
    </div>
  );
}

function formatMoney(v: unknown): string {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)} 万`;
  return n.toLocaleString();
}

export default function EnterpriseDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EnterpriseAssessment | null>(null);
  const [legalEvents, setLegalEvents] = useState<LegalEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [ent, events] = await Promise.all([getEnterprise(id), getLegalEvents(id)]);
      setData(ent);
      setLegalEvents(events);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDownloadReport() {
    if (!data) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const { report_id, status } = await generateReport(data.enterprise_id);
      if (status === "completed") {
        await downloadReport(report_id, `${data.enterprise_name}_评估报告.pdf`);
      } else {
        throw new Error("报告生成未完成");
      }
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "报告下载失败");
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
        setTimeout(() => { setEmailOpen(false); setEmailFeedback(null); setEmailAddress(""); }, 1500);
      } else {
        setEmailFeedback({ type: "error", text: res.message });
      }
    } catch (e) {
      setEmailFeedback({ type: "error", text: e instanceof Error ? e.message : "发送失败" });
    } finally {
      setEmailLoading(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return <EmptyBlock message="企业不存在" />;

  const details = data.dimension_details as Record<string, Record<string, unknown>>;
  const finDetail = details?.finance ?? {};
  const metrics = [
    { label: "信用等级", value: data.credit_level },
    { label: "纳税准时率", value: `${(data.tax_on_time_rate * 100).toFixed(1)}%` },
    { label: "发票月均", value: data.invoice_monthly_avg.toLocaleString() },
    { label: "营收偏差", value: `${(data.revenue_deviation * 100).toFixed(2)}%` },
    { label: "社保趋势", value: data.social_trend },
    { label: "行业", value: `${data.industry_l1 ?? "—"} / ${data.industry_l2 ?? "—"}` },
    { label: "地区", value: `${data.province ?? "—"} ${data.city ?? ""}`.trim() },
    { label: "净资产收益率", value: finDetail.roe != null ? `${(Number(finDetail.roe) * 100).toFixed(2)}%` : "—" },
    { label: "资产负债率", value: finDetail.debt_ratio != null ? `${(Number(finDetail.debt_ratio) * 100).toFixed(1)}%` : "—" },
    { label: "Z 值评分", value: finDetail.z_score != null ? Number(finDetail.z_score).toFixed(2) : "—" },
  ];

  return (
    <div className="w-full space-y-4 sm:space-y-5 fade-in pb-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 h-9 w-9 p-0">
          <Link to="/dashboard" aria-label="返回"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="border-white/15 gap-2">
          <Link to={`/chat?q=${encodeURIComponent(`分析${data.enterprise_name}的综合风险`)}`}>
            <LineSigil mode="idle" size={18} />
            分析
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
        <Card className="glass w-full">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl">{data.enterprise_name}</CardTitle>
                <p className="mt-1 text-sm text-neutral-500">{data.enterprise_id} · {data.province} {data.city}</p>
              </div>
              <Badge className={CREDIT_LEVEL_COLORS[data.credit_level] ?? CREDIT_LEVEL_COLORS.M}>
                信用 {data.credit_level}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-center">
              <p className={`text-6xl font-bold tabular-nums sm:text-7xl ${RISK_LEVEL_TEXT[data.risk_level] ?? "text-neutral-100"}`}>
                {data.overall_score.toFixed(1)}
              </p>
              <Badge className={`mt-2 ${RISK_LEVEL_COLORS[data.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}`}>
                {data.risk_level}
              </Badge>
            </div>
            <RadarChart data={data} />
          </CardContent>
        </Card>

        <Card className="glass w-full">
          <CardContent className="pt-5 space-y-4">
            {data.warning_signals.length === 0 ? (
              <p className="text-xs text-neutral-600 text-center py-8">无预警</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.warning_signals.map((signal) => (
                  <WarningSignalBadge key={signal} signal={signal} />
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              {DIM_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-neutral-500 shrink-0 text-xs">{DIMENSION_LABELS[k]}</span>
                  <span className="font-mono tabular-nums text-neutral-200">{data.dimensions[k].toFixed(0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.attribution && (
        <Card className="glass">
          <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {DIM_KEYS.map((k) => {
              const dim = data.attribution!.dimensions[k];
              if (!dim) return null;
              return (
                <div key={k} className="glass-card rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">{dim.label}</span>
                    <span className="text-xs font-mono text-neutral-300">{dim.net_contribution}</span>
                  </div>
                  <div className="space-y-0.5">
                    {dim.positive.map((p, i) => (
                      <p key={`p${i}`} className="text-[11px] text-teal-300/70 truncate">+ {p.item}</p>
                    ))}
                    {dim.negative.map((n, i) => (
                      <p key={`n${i}`} className="text-[11px] text-rose-300/70 truncate">− {n.item}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardContent className="pt-5">
          {legalEvents.length === 0 ? (
            <p className="text-xs text-neutral-600 py-4 text-center">无法律事件</p>
          ) : (
            <div className="space-y-2">
              {legalEvents.map((ev) => (
                <div key={ev.id} className="glass-card rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-200 truncate">{ev.description}</p>
                    <p className="text-[10px] text-neutral-600 mt-0.5">{ev.event_date} · {formatMoney(ev.amount_involved)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Badge className={LEGAL_SEVERITY_COLORS[ev.severity] ?? LEGAL_SEVERITY_COLORS.L}>{ev.severity}</Badge>
                    <Badge className="border-white/10 bg-white/[0.04] text-neutral-500 text-[10px]">
                      {LEGAL_EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <section className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
        <Button onClick={handleDownloadReport} disabled={reportLoading || emailLoading} variant="outline" className="border-white/15 gap-2">
          {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          下载报告
        </Button>
        <Button variant="outline" onClick={() => { setEmailOpen(true); setEmailFeedback(null); }} disabled={reportLoading || emailLoading} className="border-white/15 gap-2">
          <Mail className="h-4 w-4" />邮件
        </Button>
        {reportError && <p className="text-xs text-red-400 w-full">{reportError}</p>}
      </section>

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md glass rounded-xl p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-100">发送评估报告</h3>
              <button type="button" onClick={() => setEmailOpen(false)} className="rounded-md p-1 text-neutral-400 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Input type="email" placeholder="请输入收件邮箱" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} disabled={emailLoading} />
            {emailFeedback && (
              <p className={`mt-3 text-sm ${emailFeedback.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{emailFeedback.text}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={emailLoading}>取消</Button>
              <Button onClick={handleSendEmail} disabled={emailLoading || !emailAddress.trim()}>
                {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "发送"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
