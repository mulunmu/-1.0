import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as echarts from "echarts";
import { ArrowLeft, Bot, Download, Loader2, Mail, X } from "lucide-react";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getEnterprise, generateReport, downloadReport, emailReport, type EnterpriseAssessment } from "@/lib/api";
import {
  CREDIT_LEVEL_COLORS,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_TEXT,
  WARNING_SEVERITY_STYLES,
  WARNING_SIGNAL_LABELS,
} from "@/lib/labels";

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
        indicator: [
          { name: "税务健康", max: 100 },
          { name: "真实性", max: 100 },
          { name: "财务健康", max: 100 },
        ],
        center: ["50%", "55%"],
        radius: "65%",
        axisName: { color: "#94a3b8", fontSize: 12 },
        splitLine: { lineStyle: { color: "#1e293b" } },
        splitArea: { areaStyle: { color: ["rgba(17,24,39,0.8)", "rgba(17,24,39,0.4)"] } },
        axisLine: { lineStyle: { color: "#334155" } },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: [
                data.dimensions.tax_health,
                data.dimensions.authenticity,
                data.dimensions.finance,
              ],
              name: data.enterprise_name,
              areaStyle: { color: "rgba(59,130,246,0.25)" },
              lineStyle: { color: "#3b82f6", width: 2 },
              itemStyle: { color: "#60a5fa" },
            },
          ],
        },
      ],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [data]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return <div ref={chartRef} className="h-72 w-full sm:h-80" />;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-slate-800">
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function EnterpriseDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EnterpriseAssessment | null>(null);
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
      setData(await getEnterprise(id));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return <EmptyBlock message="企业不存在" />;

  const metrics = [
    { label: "信用等级", value: data.credit_level },
    { label: "纳税稳定性", value: `${(data.tax_on_time_rate * 100).toFixed(1)}%` },
    { label: "发票月均", value: data.invoice_monthly_avg.toLocaleString() },
    { label: "营收偏差", value: `${(data.revenue_deviation * 100).toFixed(2)}%` },
    { label: "社保趋势", value: data.social_trend },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
          </Button>
          {data && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/chat?q=${encodeURIComponent(`分析${data.enterprise_name}的综合风险`)}`}>
                <Bot className="h-4 w-4" />
                AI 分析
              </Link>
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧：评分 + 雷达图 */}
          <Card className="border-slate-800">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl sm:text-2xl">{data.enterprise_name}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">{data.enterprise_id}</p>
                </div>
                <Badge className={CREDIT_LEVEL_COLORS[data.credit_level] ?? CREDIT_LEVEL_COLORS.M}>
                  信用 {data.credit_level}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 text-center">
                <p className="text-sm text-slate-500">综合评分</p>
                <div className="relative inline-block">
                  <p className={`text-6xl font-bold tabular-nums sm:text-7xl ${RISK_LEVEL_TEXT[data.risk_level] ?? "text-slate-100"}`}>
                    {data.overall_score.toFixed(1)}
                  </p>
                  <span className="pointer-events-none absolute -right-2 top-0 rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-300 opacity-80">
                    模拟数据
                  </span>
                </div>
                <Badge className={`mt-2 ${RISK_LEVEL_COLORS[data.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}`}>
                  {data.risk_level}
                </Badge>
              </div>
              <RadarChart data={data} />
            </CardContent>
          </Card>

          {/* 右侧：预警信号 */}
          <Card className="border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg">预警信号</CardTitle>
              <p className="text-sm text-slate-500">
                {data.warning_signals.length > 0
                  ? `共 ${data.warning_signals.length} 项需关注`
                  : "当前无预警信号"}
              </p>
            </CardHeader>
            <CardContent>
              {data.warning_signals.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-700 py-12 text-sm text-slate-500">
                  企业经营状况良好，暂无风险预警
                </div>
              ) : (
                <ul className="space-y-3">
                  {data.warning_signals.map((signal) => {
                    const meta = WARNING_SIGNAL_LABELS[signal] ?? {
                      label: signal,
                      severity: "yellow" as const,
                    };
                    return (
                      <li key={signal}>
                        <Badge
                          className={`w-full justify-start px-4 py-2 text-sm font-normal ${WARNING_SEVERITY_STYLES[meta.severity]}`}
                        >
                          {meta.label}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-8 space-y-3 rounded-lg bg-slate-900/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">维度得分</p>
                {[
                  { name: "税务健康", score: data.dimensions.tax_health, weight: "30%" },
                  { name: "真实性", score: data.dimensions.authenticity, weight: "30%" },
                  { name: "财务健康", score: data.dimensions.finance, weight: "40%" },
                ].map((dim) => (
                  <div key={dim.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      {dim.name}
                      <span className="ml-1 text-xs text-slate-600">({dim.weight})</span>
                    </span>
                    <span className="font-medium tabular-nums text-slate-200">{dim.score.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 关键指标 */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-200">关键指标</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {metrics.map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} />
            ))}
          </div>
        </section>

        {/* 下载报告 */}
        <section className="mt-8 flex flex-col items-start gap-3 border-t border-slate-800 pt-8">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDownloadReport} disabled={reportLoading || emailLoading}>
              {reportLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {reportLoading ? "报告生成中..." : "下载评估报告"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEmailOpen(true);
                setEmailFeedback(null);
              }}
              disabled={reportLoading || emailLoading}
            >
              <Mail className="h-4 w-4" />
              发送到邮箱
            </Button>
          </div>
          {reportError && (
            <p className="text-sm text-red-400">{reportError}</p>
          )}
          <p className="text-xs text-slate-500">
            生成 3 页 PDF 报告，含三维评分雷达图、预警清单与风险提示
          </p>
        </section>

        {/* 邮件发送弹窗 */}
        {emailOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-700 bg-card p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">发送评估报告</h3>
                <button
                  type="button"
                  onClick={() => setEmailOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-sm text-slate-400">
                将 {data.enterprise_name} 的 PDF 评估报告发送至指定邮箱
              </p>
              <Input
                type="email"
                placeholder="请输入收件邮箱，如 xxx@qq.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
                disabled={emailLoading}
              />
              {emailFeedback && (
                <p
                  className={`mt-3 text-sm ${
                    emailFeedback.type === "success" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {emailFeedback.text}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEmailOpen(false)}
                  disabled={emailLoading}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={emailLoading || !emailAddress.trim()}
                >
                  {emailLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {emailLoading ? "发送中..." : "发送"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
