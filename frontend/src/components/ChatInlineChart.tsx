import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Badge } from "@/components/ui/badge";
import WarningSignalBadge from "@/components/WarningSignalBadge";
import { RISK_LEVEL_COLORS } from "@/lib/labels";
import { CHART_THEME } from "@/lib/theme";
import type { ChatCharts } from "@/lib/api";

function barColor(index: number): string {
  return CHART_THEME.dimensionBars[index % CHART_THEME.dimensionBars.length];
}

export default function ChatInlineChart({ charts }: { charts: ChatCharts }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (charts.type === "warnings" || !chartRef.current) return;
    instanceRef.current ??= echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    const chart = instanceRef.current;

    if (charts.type === "radar") {
      const d = charts.data;
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "item", ...CHART_THEME.tooltip },
        radar: {
          indicator: d.indicators,
          radius: "62%",
          axisName: { color: "#a3a3a3", fontSize: 10 },
          splitLine: { lineStyle: { color: CHART_THEME.splitLine } },
          splitArea: { areaStyle: { color: CHART_THEME.splitArea } },
          axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
        },
        series: [
          {
            type: "radar",
            data: [{
              value: d.values,
              name: d.name,
              areaStyle: { color: CHART_THEME.radar.area },
              lineStyle: { color: CHART_THEME.radar.line, width: 2 },
              itemStyle: { color: CHART_THEME.radar.item },
            }],
          },
        ],
      }, true);
    } else if (charts.type === "bar") {
      const d = charts.data;
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...CHART_THEME.tooltip },
        legend: {
          textStyle: { color: CHART_THEME.axisLabel, fontSize: 10 },
          top: 0,
          itemWidth: 8,
          itemHeight: 8,
        },
        grid: { left: 8, right: 8, bottom: 4, top: 28, containLabel: true },
        xAxis: {
          type: "category",
          data: d.labels,
          axisLabel: { color: CHART_THEME.axisLabel, fontSize: 10, rotate: d.labels.length > 4 ? 18 : 0 },
          axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          max: 100,
          axisLabel: { color: CHART_THEME.axisLabel, fontSize: 10 },
          splitLine: { lineStyle: { color: CHART_THEME.splitLine, type: "dashed" } },
          axisLine: { show: false },
        },
        series: d.series.map((s, i) => {
          const base = barColor(i);
          return {
            name: s.name,
            type: "bar",
            data: s.values,
            barMaxWidth: 28,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: `${base}cc` },
                { offset: 1, color: `${base}66` },
              ]),
              borderRadius: [3, 3, 0, 0],
            },
          };
        }),
      }, true);
    }

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [charts]);

  useEffect(() => () => {
    instanceRef.current?.dispose();
    instanceRef.current = null;
  }, []);

  if (charts.type === "warnings") {
    const items = charts.data;
    if (!items.length) {
      return <p className="text-xs text-neutral-500 py-2">暂无预警</p>;
    }
    return (
      <div className="space-y-1.5">
        {items.slice(0, 8).map((w) => (
          <div
            key={w.enterprise_name}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-sm text-neutral-200 truncate">{w.enterprise_name}</span>
              <Badge className={`text-[10px] shrink-0 ${RISK_LEVEL_COLORS[w.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}`}>
                {w.risk_level}
              </Badge>
            </div>
            {(w.warning_signals?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {w.warning_signals.slice(0, 2).map((sig) => (
                  <WarningSignalBadge key={sig} signal={sig} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return <div ref={chartRef} className="h-52 sm:h-60 w-full min-w-[260px]" />;
}
