import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { RiskCard } from "@/components/ui/RiskCard";
import { ErrorBlock, EmptyBlock } from "@/components/StateViews";
import { type EnterpriseAssessment, type RiskWarningItem } from "@/lib/api";
import { fetchEnterprises, fetchRiskWarnings, getInstantEnterprises, getInstantRiskWarnings } from "@/lib/dataSource";
import { RISK_LEVEL_COLORS, RISK_LEVEL_TEXT } from "@/lib/labels";
import * as echarts from "echarts";
import {
  Building2, AlertTriangle, TrendingUp, ShieldAlert, ChevronRight,
  MessageSquare, GitCompare, Search, BarChart3, Zap,
} from "lucide-react";
import {
  CHART_THEME, RISK_CHART_COLORS, RISK_LEVEL_ORDER,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { chatUrl, CHAT_QUERIES, ROUTES } from "@/lib/routes";
import { QUICK_COMPARE_QUERY, QUICK_WARNINGS_QUERY, QUICK_RANKING_QUERY } from "@/lib/constants";

function buildRiskBarOption(enterprises: EnterpriseAssessment[]): echarts.EChartsOption {
  const categories = [...RISK_LEVEL_ORDER].reverse();
  const values = categories.map((name) => enterprises.filter((e) => e.risk_level === name).length);
  const maxVal = Math.max(...values, 1);

  return {
    backgroundColor: "transparent",
    grid: { left: 72, right: 48, top: 16, bottom: 12, containLabel: false },
    tooltip: { trigger: "axis", axisPointer: { type: "none" }, ...CHART_THEME.tooltip },
    xAxis: {
      type: "value",
      max: Math.ceil(maxVal * 1.15),
      splitLine: { lineStyle: { color: CHART_THEME.splitLine, type: "dashed" } },
      axisLabel: { color: CHART_THEME.axisLabel, fontSize: 10 },
      axisLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: CHART_THEME.axisLabel, fontSize: 11 },
      axisLine: { show: false },
    },
    series: [{
      type: "bar",
      data: values.map((value, i) => ({
        value,
        itemStyle: {
          color: RISK_CHART_COLORS[categories[i]] ?? CHART_THEME.axisLabel,
          borderRadius: [0, 6, 6, 0],
        },
      })),
      barWidth: 18,
      label: { show: true, position: "right", color: CHART_THEME.axisLabel, fontSize: 11, formatter: "{c}" },
    }],
  };
}

const QUICK = [
  { label: "搜索企业", query: CHAT_QUERIES.search, icon: Search },
  { label: "企业对比", query: CHAT_QUERIES.compareDefault, icon: GitCompare },
  { label: "风险预警", query: CHAT_QUERIES.warnings, icon: AlertTriangle },
  { label: "行业排名", query: QUICK_RANKING_QUERY, icon: BarChart3 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [enterprises, setEnterprises] = useState<EnterpriseAssessment[]>(() => getInstantEnterprises());
  const [warnings, setWarnings] = useState<RiskWarningItem[]>(() => getInstantRiskWarnings());
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstRef = useRef<echarts.ECharts | null>(null);

  const fetchData = useCallback(() => {
    setError(null);
    Promise.all([fetchEnterprises(), fetchRiskWarnings()])
      .then(([ents, warns]) => { setEnterprises(ents); setWarnings(warns); })
      .catch((e) => setError(e instanceof Error ? e.message : "数据加载失败"));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const highRisk = enterprises.filter((e) => e.risk_level?.includes("高")).length;
  const avg = enterprises.length
    ? enterprises.reduce((s, e) => s + e.overall_score, 0) / enterprises.length
    : 0;

  const refreshChart = useCallback(() => {
    chartInstRef.current?.setOption(buildRiskBarOption(enterprises), true);
  }, [enterprises]);

  useEffect(() => {
    if (!chartRef.current || !enterprises.length) return;
    chartInstRef.current ??= echarts.init(chartRef.current);
    refreshChart();
    const ro = new ResizeObserver(() => chartInstRef.current?.resize());
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chartInstRef.current?.dispose(); chartInstRef.current = null; };
  }, [enterprises, refreshChart]);

  if (error) return <ErrorBlock message={error} onRetry={fetchData} />;

  const kpis = [
    { icon: Building2, val: enterprises.length, label: "监控企业", danger: false },
    { icon: ShieldAlert, val: highRisk, label: "高风险", danger: true },
    { icon: AlertTriangle, val: warnings.length, label: "活跃预警", danger: false },
    { icon: TrendingUp, val: avg.toFixed(1), label: "样本均分", danger: false },
  ];

  return (
    <div ref={pageRef} className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden sm:gap-4">
      <div data-reveal className="shrink-0">
        <RiskCard className="p-6 sm:p-8 relative overflow-hidden">
          <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="status-dot" />
                <span className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">Risk Infrastructure</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                风控<span className="font-semibold text-neutral-200">工作台</span>
              </h1>
              <p className="text-sm text-neutral-500 mt-3">200 家样本 · 五维评分 · 关系网络 · 智能分析</p>
            </div>
            <button type="button" onClick={() => navigate(ROUTES.network)} className="flux-pill shrink-0">
              <Zap size={14} className="text-neutral-400" />
              关系网络
            </button>
          </div>
        </RiskCard>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const inner = (
            <>
              <div className="flex items-start justify-between">
                <k.icon
                  size={20}
                  className={cn(!k.danger && "text-blue-400")}
                  style={k.danger ? { color: RISK_CHART_COLORS["高风险"] } : undefined}
                />
                <span className="text-[10px] text-slate-500">{k.label}</span>
              </div>
              <p
                className="kpi-value text-neutral-100 mt-4"
                style={k.danger ? { color: RISK_CHART_COLORS["高风险"] } : undefined}
              >
                {k.val}
              </p>
            </>
          );
          return k.danger ? (
            <div key={k.label} data-reveal>
              <RiskCard className="p-5 h-full border-l-2" style={{ borderLeftColor: RISK_CHART_COLORS["高风险"] }}>{inner}</RiskCard>
            </div>
          ) : (
            <div key={k.label} data-reveal>
              <RiskCard className="p-5 h-full">{inner}</RiskCard>
            </div>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
        <div data-reveal className="lg:col-span-5 flex min-h-[220px]">
          <RiskCard className="flex h-full min-h-0 w-full flex-col p-5">
            <p className="text-xs text-blue-400 tracking-widest uppercase mb-1">Distribution</p>
            <p className="text-sm text-slate-300 mb-2">风险等级分布</p>
            <div ref={chartRef} className="min-h-[180px] w-full flex-1" />
          </RiskCard>
        </div>
        <div data-reveal className="lg:col-span-7 flex min-h-[220px]">
          <RiskCard className="flex h-full min-h-0 w-full flex-col p-5">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div>
                <p className="text-xs text-indigo-400 tracking-widest uppercase">Alerts</p>
                <p className="text-sm text-slate-300">实时预警流</p>
              </div>
              <button type="button" onClick={() => navigate(chatUrl(CHAT_QUERIES.warnings))} className="text-xs text-blue-400 flex items-center gap-0.5 hover:text-blue-300">
                展开 <ChevronRight size={14} />
              </button>
            </div>
            <div className="terminal-strip min-h-0 flex-1 overflow-y-auto">
              {warnings.slice(0, 8).map((w) => (
                <button
                  key={w.enterprise_id}
                  type="button"
                  onClick={() => navigate(`/enterprise/${w.enterprise_id}`)}
                  className="terminal-strip-row w-full text-left"
                >
                  <span className="text-red-400">▸</span>
                  <span className="text-slate-200 truncate flex-1">{w.enterprise_name}</span>
                  <span className={cn("text-xs font-mono", RISK_LEVEL_TEXT[w.risk_level])}>{w.overall_score.toFixed(1)}</span>
                  <Badge className={cn("text-[9px]", RISK_LEVEL_COLORS[w.risk_level])}>{w.risk_level}</Badge>
                </button>
              ))}
              {!warnings.length && <EmptyBlock message="暂无预警数据" />}
            </div>
          </RiskCard>
        </div>
      </div>

      <div data-reveal className="shrink-0">
        <RiskCard className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-indigo-400" />
            <p className="text-sm text-slate-200">智能分析 · 一键提问</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q.label} type="button" onClick={() => navigate(chatUrl(q.query))} className="flux-pill">
                <q.icon size={14} className="text-blue-400" />
                {q.label}
              </button>
            ))}
          </div>
        </RiskCard>
      </div>
    </div>
  );
}
