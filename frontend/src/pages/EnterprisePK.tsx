import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as echarts from "echarts";
import { ArrowLeft, X } from "lucide-react";
import SearchBox from "@/components/SearchBox";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAllEnterprises,
  getEnterprisePK,
  type EnterpriseAssessment,
} from "@/lib/api";
import {
  DIMENSION_LABELS,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_TEXT,
} from "@/lib/labels";

const MAX_PK = 5;
const DIM_KEYS = ["tax_health", "authenticity", "finance"] as const;

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
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: {
        data: Object.values(DIMENSION_LABELS),
        textStyle: { color: "#94a3b8" },
        top: 0,
      },
      grid: { left: 48, right: 16, bottom: 48, top: 40, containLabel: true },
      xAxis: {
        type: "category",
        data: names,
        axisLabel: {
          color: "#94a3b8",
          interval: 0,
          rotate: names.length > 3 ? 20 : 0,
          formatter: (v: string) => (v.length > 8 ? `${v.slice(0, 8)}…` : v),
        },
        axisLine: { lineStyle: { color: "#334155" } },
      },
      yAxis: {
        type: "value",
        max: 100,
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "#1e293b" } },
      },
      series: DIM_KEYS.map((key, i) => ({
        name: DIMENSION_LABELS[key],
        type: "bar",
        barGap: 0,
        data: data.map((d) => d.dimensions[key]),
        itemStyle: {
          color: ["#3b82f6", "#8b5cf6", "#10b981"][i],
          borderRadius: [4, 4, 0, 0],
        },
      })),
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [data]);

  useEffect(() => {
    instanceRef.current?.resize();
  }, [data]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return <div ref={chartRef} className="h-80 w-full" />;
}

function HeatmapChart({ data }: { data: EnterpriseAssessment[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;
    instanceRef.current ??= echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    const chart = instanceRef.current;

    const xLabels = data.map((d) => d.enterprise_name);
    const yLabels = DIM_KEYS.map((k) => DIMENSION_LABELS[k]);
    const heatData: [number, number, number][] = [];
    DIM_KEYS.forEach((key, yi) => {
      data.forEach((d, xi) => {
        heatData.push([xi, yi, d.dimensions[key]]);
      });
    });

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        position: "top",
        formatter: (p: { data: [number, number, number] }) => {
          const [xi, yi, val] = p.data;
          return `${xLabels[xi]}<br/>${yLabels[yi]}: <b>${val.toFixed(1)}</b>`;
        },
      },
      grid: { left: 80, right: 60, bottom: 48, top: 16, containLabel: true },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLabel: {
          color: "#94a3b8",
          interval: 0,
          rotate: xLabels.length > 3 ? 20 : 0,
          formatter: (v: string) => (v.length > 8 ? `${v.slice(0, 8)}…` : v),
        },
        splitArea: { show: true },
      },
      yAxis: {
        type: "category",
        data: yLabels,
        axisLabel: { color: "#94a3b8" },
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: "vertical",
        right: 0,
        top: "center",
        inRange: { color: ["#1e3a5f", "#3b82f6", "#60a5fa", "#93c5fd"] },
        textStyle: { color: "#94a3b8" },
      },
      series: [
        {
          type: "heatmap",
          data: heatData,
          label: {
            show: true,
            color: "#e2e8f0",
            formatter: (p: { data: [number, number, number] }) => p.data[2].toFixed(0),
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.4)" },
          },
        },
      ],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [data]);

  useEffect(() => {
    instanceRef.current?.resize();
  }, [data]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return <div ref={chartRef} className="h-64 w-full" />;
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
      if (next.length === 0) {
        setSearchParams({});
      } else {
        setSearchParams({ ids: next.join(",") });
      }
    },
    [setSearchParams],
  );

  const loadCatalog = useCallback(async () => {
    try {
      setAllEnterprises(await getAllEnterprises());
    } catch {
      /* catalog optional for tags */
    }
  }, []);

  const loadPk = useCallback(async () => {
    if (selectedIds.length === 0) {
      setPkData([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
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

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    loadPk();
  }, [loadPk]);

  function addEnterprise(id: string) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_PK) return;
    setSelectedIds([...selectedIds, id]);
  }

  function removeEnterprise(id: string) {
    setSelectedIds(selectedIds.filter((x) => x !== id));
  }

  const idToName = useMemo(() => {
    const map = new Map<string, string>();
    allEnterprises.forEach((e) => map.set(e.enterprise_id, e.enterprise_name));
    pkData.forEach((e) => map.set(e.enterprise_id, e.enterprise_name));
    return map;
  }, [allEnterprises, pkData]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </Button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">企业 PK 对比</h1>
          <p className="mt-1 text-sm text-slate-400">最多选择 {MAX_PK} 家企业进行三维评分对比</p>
        </div>

        {/* 已选标签 + 添加搜索 */}
        <Card className="mb-6 border-slate-800">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.length === 0 ? (
                <span className="text-sm text-slate-500">尚未选择企业，请通过下方搜索添加</span>
              ) : (
                selectedIds.map((id) => (
                  <Badge
                    key={id}
                    className="flex items-center gap-1 border-slate-600 bg-slate-800 px-3 py-1 text-slate-200"
                  >
                    {idToName.get(id) ?? id}
                    <button
                      type="button"
                      onClick={() => removeEnterprise(id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-slate-700"
                      aria-label={`移除 ${id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
              {selectedIds.length > 0 && (
                <span className="text-xs text-slate-500">
                  {selectedIds.length}/{MAX_PK}
                </span>
              )}
            </div>
            {selectedIds.length < MAX_PK && (
              <SearchBox
                enterprises={allEnterprises}
                excludeIds={selectedIds}
                onSelect={addEnterprise}
                placeholder="添加企业..."
                className="max-w-md"
              />
            )}
          </CardContent>
        </Card>

        {loading && <LoadingBlock />}
        {!loading && error && <ErrorBlock message={error} onRetry={loadPk} />}
        {!loading && !error && selectedIds.length === 0 && (
          <EmptyBlock message="请添加至少一家企业开始对比" />
        )}
        {!loading && !error && pkData.length > 0 && (
          <>
            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="border-slate-800 lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">三维评分对比</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChart data={pkData} />
                </CardContent>
              </Card>

              <Card className="border-slate-800 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">综合分排名</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-slate-500">
                        <th className="pb-2 pr-2">#</th>
                        <th className="pb-2 pr-2">企业</th>
                        <th className="pb-2 pr-2">总分</th>
                        <th className="pb-2">风险</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pkData.map((ent, idx) => (
                        <tr
                          key={ent.enterprise_id}
                          className="border-b border-slate-800/60 hover:bg-slate-800/30"
                        >
                          <td className="py-3 pr-2 text-slate-500">{idx + 1}</td>
                          <td className="py-3 pr-2">
                            <Link
                              to={`/enterprise/${ent.enterprise_id}`}
                              className="font-medium text-slate-200 hover:text-blue-400"
                            >
                              {ent.enterprise_name}
                            </Link>
                            <p className="text-xs text-slate-500">{ent.enterprise_id}</p>
                          </td>
                          <td className={`py-3 pr-2 font-bold tabular-nums ${RISK_LEVEL_TEXT[ent.risk_level] ?? ""}`}>
                            {ent.overall_score.toFixed(1)}
                          </td>
                          <td className="py-3">
                            <Badge className={RISK_LEVEL_COLORS[ent.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}>
                              {ent.risk_level}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 space-y-2">
                    {pkData.map((ent) => (
                      <div key={ent.enterprise_id} className="rounded-lg bg-slate-900/50 p-3 text-xs">
                        <p className="mb-1 font-medium text-slate-300">{ent.enterprise_name}</p>
                        <div className="flex justify-between text-slate-500">
                          <span>税务 {ent.dimensions.tax_health.toFixed(1)}</span>
                          <span>真实 {ent.dimensions.authenticity.toFixed(1)}</span>
                          <span>财务 {ent.dimensions.finance.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">维度差异热力图</CardTitle>
                <p className="text-sm text-slate-500">颜色越深表示分值越高</p>
              </CardHeader>
              <CardContent>
                <HeatmapChart data={pkData} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
