import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { Badge } from "@/components/ui/badge";
import { WARNING_SIGNAL_LABELS, RISK_LEVEL_COLORS } from "@/lib/labels";
import type { ChatCharts } from "@/lib/api";

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
        radar: {
          indicator: d.indicators,
          radius: "60%",
          axisName: { color: "#94a3b8", fontSize: 10 },
          splitLine: { lineStyle: { color: "#334155" } },
          axisLine: { lineStyle: { color: "#334155" } },
        },
        series: [
          {
            type: "radar",
            data: [{ value: d.values, name: d.name, areaStyle: { color: "rgba(59,130,246,0.2)" } }],
          },
        ],
      });
    } else if (charts.type === "bar") {
      const d = charts.data;
      chart.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "axis" },
        legend: { textStyle: { color: "#94a3b8" }, top: 0 },
        grid: { left: 40, right: 10, bottom: 40, top: 30, containLabel: true },
        xAxis: {
          type: "category",
          data: d.labels,
          axisLabel: { color: "#94a3b8", fontSize: 10, rotate: 15 },
        },
        yAxis: { type: "value", max: 100, axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "#1e293b" } } },
        series: d.series.map((s, i) => ({
          name: s.name,
          type: "bar",
          data: s.values,
          itemStyle: { color: ["#3b82f6", "#8b5cf6", "#10b981"][i % 3], borderRadius: [3, 3, 0, 0] },
        })),
      });
    }

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [charts]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  if (charts.type === "warnings") {
    const items = charts.data;
    if (!items.length) {
      return <p className="text-sm text-slate-500">暂无预警企业</p>;
    }
    return (
      <div className="space-y-2">
        {items.map((w) => (
          <div key={w.enterprise_name} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200">{w.enterprise_name}</span>
              <Badge className={RISK_LEVEL_COLORS[w.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}>
                {w.risk_level}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {(w.signal_labels ?? w.warning_signals).map((sig, idx) => (
                <Badge
                  key={idx}
                  className="border-red-500/30 bg-red-500/10 text-xs font-normal text-red-400"
                >
                  {typeof sig === "string" && WARNING_SIGNAL_LABELS[sig]
                    ? WARNING_SIGNAL_LABELS[sig].label
                    : sig}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <div ref={chartRef} className="mt-2 h-52 w-full" />;
}
