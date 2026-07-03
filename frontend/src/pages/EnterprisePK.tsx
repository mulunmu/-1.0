import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";
import { X } from "lucide-react";
import SearchBox from "@/components/SearchBox";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAllEnterprises, getEnterprisePK, type EnterpriseAssessment } from "@/lib/api";
import { DIMENSION_LABELS, RISK_LEVEL_COLORS, RISK_LEVEL_TEXT } from "@/lib/labels";
import { CHART_THEME } from "@/lib/theme";

const MAX_PK = 5;
const DIM_KEYS_PK = ["tax_health", "authenticity", "industry", "legal", "finance"] as const;

function BarChart({ data }: { data: EnterpriseAssessment[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    instanceRef.current ??= echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    const chart = instanceRef.current;
    const names = data.map((d) => d.enterprise_name);

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...CHART_THEME.tooltip },
      legend: { data: Object.values(DIMENSION_LABELS), textStyle: { color: CHART_THEME.axisLabel }, top: 0 },
      grid: { left: 40, right: 12, bottom: 48, top: 40, containLabel: true },
      xAxis: {
        type: "category",
        data: names,
        axisLabel: {
          color: CHART_THEME.axisLabel,
          interval: 0,
          rotate: names.length > 2 ? 25 : 0,
          formatter: (v: string) => (v.length > 6 ? `${v.slice(0, 6)}…` : v),
        },
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
      },
      yAxis: {
        type: "value",
        max: 100,
        axisLabel: { color: CHART_THEME.axisLabel },
        splitLine: { lineStyle: { color: CHART_THEME.splitLine } },
      },
      series: DIM_KEYS_PK.map((key, i) => ({
        name: DIMENSION_LABELS[key],
        type: "bar",
        barGap: 0,
        data: data.map((d) => d.dimensions[key]),
        itemStyle: {
          color: CHART_THEME.dimensionBars[i],
          borderRadius: [4, 4, 0, 0],
        },
      })),
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [data]);

  useEffect(() => () => { instanceRef.current?.dispose(); instanceRef.current = null; }, []);

  return <div ref={chartRef} className="h-64 sm:h-80 w-full min-w-0" />;
}

function HeatmapChart({ data }: { data: EnterpriseAssessment[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    instanceRef.current ??= echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    const chart = instanceRef.current;
    const xLabels = data.map((d) => d.enterprise_name);
    const yLabels = DIM_KEYS_PK.map((k) => DIMENSION_LABELS[k]);
    const heatData: [number, number, number][] = [];
    DIM_KEYS_PK.forEach((key, yi) => {
      data.forEach((d, xi) => heatData.push([xi, yi, d.dimensions[key]]));
    });

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        position: "top",
        ...CHART_THEME.tooltip,
        formatter: (p: { data: [number, number, number] }) => {
          const [xi, yi, val] = p.data;
          return `${xLabels[xi]}<br/>${yLabels[yi]}: <b>${val.toFixed(1)}</b>`;
        },
      },
      grid: { left: 72, right: 48, bottom: 48, top: 16, containLabel: true },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLabel: {
          color: CHART_THEME.axisLabel,
          interval: 0,
          rotate: xLabels.length > 2 ? 25 : 0,
          formatter: (v: string) => (v.length > 6 ? `${v.slice(0, 6)}…` : v),
        },
        splitArea: { show: true },
      },
      yAxis: {
        type: "category",
        data: yLabels,
        axisLabel: { color: CHART_THEME.axisLabel },
        splitArea: { show: true },
      },
      visualMap: {
        min: 0, max: 100, calculable: true, orient: "horizontal",
        left: "center", bottom: 0,
        inRange: { color: CHART_THEME.heatmap },
        textStyle: { color: CHART_THEME.axisLabel },
      },
      series: [{
        type: "heatmap",
        data: heatData,
        label: { show: true, color: "#e2e8f0", formatter: (p: { data: [number, number, number] }) => p.data[2].toFixed(0) },
      }],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [data]);

  useEffect(() => () => { instanceRef.current?.dispose(); instanceRef.current = null; }, []);

  return <div ref={chartRef} className="h-56 sm:h-64 w-full min-w-0" />;
}

export default function EnterprisePK() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allEnterprises, setAllEnterprises] = useState<EnterpriseAssessment[]>([]);
  const [pkData, setPkData] = useState<EnterpriseAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => {
    const raw = searchParams.get("ids") ?? "";
    return raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_PK);
  }, [searchParams]);

  const setSelectedIds = useCallback(
    (ids: string[]) => {
      const next = ids.slice(0, MAX_PK);
      setSearchParams(next.length === 0 ? {} : { ids: next.join(",") });
    },
    [setSearchParams],
  );

  const loadCatalog = useCallback(async () => {
    try { setAllEnterprises(await getAllEnterprises()); } catch { /* optional */ }
  }, []);

  const loadPk = useCallback(async () => {
    if (selectedIds.length === 0) {
      setPkData([]); setLoading(false); setError(null); return;
    }
    setLoading(true); setError(null);
    try {
      const data = await getEnterprisePK(selectedIds);
      setPkData(data.sort((a, b) => b.overall_score - a.overall_score));
    } catch (e) {
      setPkData([]);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [selectedIds]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { loadPk(); }, [loadPk]);

  const idToName = useMemo(() => {
    const map = new Map<string, string>();
    allEnterprises.forEach((e) => map.set(e.enterprise_id, e.enterprise_name));
    pkData.forEach((e) => map.set(e.enterprise_id, e.enterprise_name));
    return map;
  }, [allEnterprises, pkData]);

  return (
    <div className="w-full space-y-4 sm:space-y-5 fade-in pb-6">
      <Card className="glass">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.map((id) => (
              <Badge key={id} className="flex items-center gap-1 border-white/15 bg-white/[0.06] px-3 py-1 text-neutral-200 max-w-full">
                <span className="truncate">{idToName.get(id) ?? id}</span>
                <button type="button" onClick={() => setSelectedIds(selectedIds.filter((x) => x !== id))} className="ml-1 shrink-0 rounded-full p-0.5 hover:bg-white/10">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {selectedIds.length < MAX_PK && (
            <SearchBox enterprises={allEnterprises} excludeIds={selectedIds} onSelect={(id) => setSelectedIds([...selectedIds, id])} placeholder="添加企业" className="w-full max-w-md" />
          )}
        </CardContent>
      </Card>

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={loadPk} />}
      {!loading && !error && selectedIds.length === 0 && <EmptyBlock message="添加企业开始对比" />}

      {!loading && !error && pkData.length > 0 && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6">
            <Card className="glass xl:col-span-3 min-w-0">
              <CardContent className="pt-4 overflow-x-auto"><BarChart data={pkData} /></CardContent>
            </Card>

            <Card className="glass xl:col-span-2 min-w-0">
              <CardContent className="pt-4">
                {/* 桌面表格 */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm min-w-[280px]">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-left text-neutral-500">
                        <th className="pb-2 pr-2">#</th>
                        <th className="pb-2 pr-2">企业</th>
                        <th className="pb-2 pr-2">总分</th>
                        <th className="pb-2">风险</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pkData.map((ent, idx) => (
                        <tr key={ent.enterprise_id} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                          <td className="py-3 pr-2 text-neutral-500">{idx + 1}</td>
                          <td className="py-3 pr-2 min-w-0">
                            <Link to={`/enterprise/${ent.enterprise_id}`} className="font-medium text-neutral-200 hover:text-white truncate block">{ent.enterprise_name}</Link>
                            <p className="text-xs text-neutral-600">{ent.enterprise_id}</p>
                          </td>
                          <td className={`py-3 pr-2 font-bold tabular-nums ${RISK_LEVEL_TEXT[ent.risk_level] ?? ""}`}>{ent.overall_score.toFixed(1)}</td>
                          <td className="py-3"><Badge className={RISK_LEVEL_COLORS[ent.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}>{ent.risk_level}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* 移动端卡片 */}
                <div className="sm:hidden space-y-3">
                  {pkData.map((ent, idx) => (
                    <Link key={ent.enterprise_id} to={`/enterprise/${ent.enterprise_id}`} className="block glass-card rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-neutral-500 text-xs">#{idx + 1}</span>
                        <Badge className={RISK_LEVEL_COLORS[ent.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}>{ent.risk_level}</Badge>
                      </div>
                      <p className="font-medium text-neutral-200 mt-1 truncate">{ent.enterprise_name}</p>
                      <p className={`text-2xl font-bold tabular-nums mt-2 ${RISK_LEVEL_TEXT[ent.risk_level] ?? ""}`}>{ent.overall_score.toFixed(1)}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass min-w-0">
            <CardContent className="pt-4 overflow-x-auto"><HeatmapChart data={pkData} /></CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
