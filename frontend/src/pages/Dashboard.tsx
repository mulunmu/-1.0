import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import WarningSignalBadge from "@/components/WarningSignalBadge";
import { getAllEnterprises, getRiskWarnings, type EnterpriseAssessment, type RiskWarningItem } from "@/lib/api";
import {
  CREDIT_LEVEL_FILTER_OPTIONS,
  INDUSTRY_FILTER_OPTIONS,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_FILTER_OPTIONS,
  RISK_LEVEL_TEXT,
} from "@/lib/labels";
import * as echarts from "echarts";
import { Building2, AlertTriangle, TrendingUp, ShieldAlert, ChevronRight } from "lucide-react";
import {
  CHART_THEME,
  CREDIT_CHART_COLORS,
  RISK_CHART_COLORS,
  RISK_LEVEL_ORDER,
  STAT_ACCENT_COLORS,
  riskGlowStyle,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

function buildRiskBarOption(enterprises: EnterpriseAssessment[]): echarts.EChartsOption {
  const categories = [...RISK_LEVEL_ORDER].reverse();
  const values = categories.map((name) => enterprises.filter((e) => e.risk_level === name).length);
  const maxVal = Math.max(...values, 1);

  return {
    backgroundColor: "transparent",
    grid: { left: 72, right: 48, top: 12, bottom: 12, containLabel: false },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "none" },
      ...CHART_THEME.tooltip,
      formatter: (params: unknown) => {
        const p = (Array.isArray(params) ? params[0] : params) as { name: string; value: number };
        const pct = enterprises.length ? ((p.value / enterprises.length) * 100).toFixed(1) : "0";
        return `${p.name}<br/>${p.value} 家 · ${pct}%`;
      },
    },
    xAxis: {
      type: "value",
      max: Math.ceil(maxVal * 1.15),
      splitLine: { lineStyle: { color: CHART_THEME.splitLine, type: "dashed" } },
      axisLabel: { color: CHART_THEME.axisLabel, fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#a3a3a3", fontSize: 11, margin: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: values.map((value, i) => {
          const name = categories[i];
          const base = RISK_CHART_COLORS[name] ?? "#737373";
          return {
            value,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: `${base}55` },
                { offset: 1, color: base },
              ]),
              borderRadius: [0, 3, 3, 0],
            },
          };
        }),
        barWidth: 16,
        barCategoryGap: "38%",
        label: {
          show: true,
          position: "right",
          color: "#737373",
          fontSize: 11,
          formatter: "{c} 家",
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: "rgba(255,255,255,0.12)",
          },
        },
      },
    ],
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [enterprises, setEnterprises] = useState<EnterpriseAssessment[]>([]);
  const [warnings, setWarnings] = useState<RiskWarningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [industryFilter, setIndustryFilter] = useState("全部");
  const [creditFilter, setCreditFilter] = useState("全部");
  const [riskFilter, setRiskFilter] = useState("全部");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    Promise.all([getAllEnterprises(), getRiskWarnings()])
      .then(([ents, warns]) => { setEnterprises(ents); setWarnings(warns); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return enterprises.filter((e) => {
      if (industryFilter !== "全部" && e.industry_l1 !== industryFilter) return false;
      if (creditFilter !== "全部" && e.credit_level !== creditFilter) return false;
      if (riskFilter !== "全部" && e.risk_level !== riskFilter) return false;
      return true;
    });
  }, [enterprises, industryFilter, creditFilter, riskFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [industryFilter, creditFilter, riskFilter]);

  const visible = filtered.slice(0, visibleCount);
  const highRisk = enterprises.filter((e) => e.risk_level?.includes("高")).length;
  const avg = enterprises.length > 0
    ? enterprises.reduce((s, e) => s + e.overall_score, 0) / enterprises.length
    : 0;

  const refreshChart = useCallback(() => {
    if (!chartInstRef.current || enterprises.length === 0) return;
    chartInstRef.current.setOption(buildRiskBarOption(enterprises), true);
  }, [enterprises]);

  useEffect(() => {
    if (!chartRef.current || enterprises.length === 0) return;
    chartInstRef.current ??= echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    refreshChart();

    const ro = new ResizeObserver(() => {
      chartInstRef.current?.resize();
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      chartInstRef.current?.dispose();
      chartInstRef.current = null;
    };
  }, [enterprises, refreshChart]);

  const filterSelect = (
    id: string,
    value: string,
    onChange: (v: string) => void,
    options: readonly { value: string; label: string }[],
  ) => (
    <select
      id={id}
      aria-label={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-xs text-neutral-200 focus:outline-none focus:border-white/25"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );

  if (loading) {
    return (
      <div className="w-full space-y-5 fade-in">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 sm:h-28 glass" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Skeleton className="h-80 glass lg:col-span-5" />
          <Skeleton className="h-80 glass lg:col-span-7" />
        </div>
        <Skeleton className="h-96 glass" />
      </div>
    );
  }

  const stats = [
    { icon: <Building2 size={20} />, val: enterprises.length, label: "总数", iconColor: STAT_ACCENT_COLORS.total.icon, valueColor: STAT_ACCENT_COLORS.total.value },
    { icon: <ShieldAlert size={20} />, val: highRisk, label: "高风险", iconColor: STAT_ACCENT_COLORS.highRisk.icon, valueColor: STAT_ACCENT_COLORS.highRisk.value },
    { icon: <AlertTriangle size={20} />, val: warnings.length, label: "预警", iconColor: STAT_ACCENT_COLORS.warnings.icon, valueColor: STAT_ACCENT_COLORS.warnings.value },
    { icon: <TrendingUp size={20} />, val: avg.toFixed(1), label: "均分", iconColor: STAT_ACCENT_COLORS.average.icon, valueColor: STAT_ACCENT_COLORS.average.value },
  ];

  return (
    <div className="w-full max-w-none space-y-5 sm:space-y-6 fade-in pb-8">
      {/* 指标卡 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="glass min-w-0">
            <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/[0.08] bg-white/[0.03]"
                style={{ boxShadow: `0 0 16px ${s.iconColor}15` }}
              >
                <div style={{ color: s.iconColor }}>{s.icon}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-2xl sm:text-3xl font-bold font-mono tracking-tight leading-none"
                  style={{ color: s.valueColor }}
                >
                  {s.val}
                </p>
                <p className="text-xs text-neutral-500 mt-1.5 truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 图表 + 预警 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        <Card className="glass lg:col-span-5 flex flex-col min-h-[300px]">
          <CardContent className="flex-1 pt-4 pb-4 min-h-0">
            <div ref={chartRef} className="w-full h-[260px] sm:h-[300px] lg:h-full lg:min-h-[280px]" />
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-7 flex flex-col min-h-[300px]">
          <CardHeader className="pb-0 flex flex-row items-center justify-end gap-2 pt-4 px-5">
            <button
              type="button"
              onClick={() => navigate("/warnings")}
              className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-0.5 transition-colors shrink-0"
              aria-label="全部预警"
            >
              全部
              <ChevronRight size={14} />
            </button>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden pt-0">
            <div className="h-full max-h-[320px] lg:max-h-none overflow-y-auto -mx-1 px-1 space-y-1">
              {warnings.slice(0, 8).map((w) => (
                <button
                  key={w.enterprise_id}
                  type="button"
                  onClick={() => navigate(`/enterprise/${w.enterprise_id}`)}
                  className="w-full text-left rounded-xl border border-transparent hover:border-white/10 hover:bg-white/[0.04] px-3 py-3 transition-colors"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-200 line-clamp-1">{w.enterprise_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={cn("text-xs font-mono tabular-nums", RISK_LEVEL_TEXT[w.risk_level] ?? "text-neutral-400")}>
                          {w.overall_score.toFixed(1)}
                        </span>
                        <Badge className={cn("text-[10px]", RISK_LEVEL_COLORS[w.risk_level] ?? RISK_LEVEL_COLORS["高风险"])}>
                          {w.risk_level}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:justify-end sm:max-w-[52%] shrink-0">
                      {w.warning_signals.slice(0, 2).map((sig) => (
                        <WarningSignalBadge key={sig} signal={sig} />
                      ))}
                      {w.warning_signals.length > 2 && (
                        <span className="text-[10px] text-neutral-600 self-center px-1">+{w.warning_signals.length - 2}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {warnings.length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-10">暂无预警企业</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 企业列表 */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {filterSelect("industry-filter", industryFilter, setIndustryFilter, INDUSTRY_FILTER_OPTIONS)}
            {filterSelect("credit-filter", creditFilter, setCreditFilter, CREDIT_LEVEL_FILTER_OPTIONS)}
            {filterSelect("risk-filter", riskFilter, setRiskFilter, RISK_LEVEL_FILTER_OPTIONS)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 sm:gap-3">
            {visible.map((e) => {
              const cm = CREDIT_CHART_COLORS[e.credit_level] || CREDIT_CHART_COLORS.M;
              return (
                <button
                  key={e.enterprise_id}
                  type="button"
                  onClick={() => navigate(`/enterprise/${e.enterprise_id}`)}
                  className="glass-card rounded-xl p-3 sm:p-3.5 text-left min-w-0 group transition-transform hover:scale-[1.02]"
                >
                  <p className="text-sm font-medium line-clamp-2 text-neutral-200 group-hover:text-white transition-colors leading-snug min-h-[2.5rem]">
                    {e.enterprise_name}
                  </p>
                  <p className="text-[10px] text-neutral-600 mt-1 truncate">{e.industry_l1 ?? "—"}</p>
                  <div className="flex items-center justify-between mt-2.5 gap-1">
                    <span className="text-lg font-bold font-mono tabular-nums" style={riskGlowStyle(e.risk_level)}>
                      {e.overall_score.toFixed(0)}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0"
                      style={{ color: cm.color, backgroundColor: cm.bg, borderColor: `${cm.color}30` }}
                    >
                      {e.credit_level}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-12">无符合筛选条件的企业</p>
          )}
          {visible.length < filtered.length && (
            <div className="mt-5 flex justify-center">
              <Button
                variant="outline"
                className="border-white/15"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                更多 · {visible.length}/{filtered.length}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
