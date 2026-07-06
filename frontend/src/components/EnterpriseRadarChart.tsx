import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { CHART_THEME } from "@/lib/theme";
import { DIM_KEYS, DIMENSION_LABELS } from "@/lib/labels";
import type { EnterpriseAssessment } from "@/lib/api";

export default function EnterpriseRadarChart({ data }: { data: EnterpriseAssessment }) {
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
        center: ["50%", "52%"],
        radius: "60%",
        axisName: { color: CHART_THEME.axisLabel, fontSize: 11, fontFamily: "Inter, sans-serif" },
        splitLine: { lineStyle: { color: CHART_THEME.splitLine } },
        splitArea: { areaStyle: { color: CHART_THEME.splitArea } },
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
      },
      series: [{
        type: "radar",
        symbol: "circle",
        symbolSize: 4,
        data: [{
          value: DIM_KEYS.map((k) => data.dimensions[k]),
          name: data.enterprise_name,
          lineStyle: { color: CHART_THEME.radar.line, width: 1.5 },
          itemStyle: { color: CHART_THEME.radar.item },
        }],
      }],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [data]);

  useEffect(() => () => {
    instanceRef.current?.dispose();
    instanceRef.current = null;
  }, []);

  return <div ref={chartRef} className="h-64 w-full sm:h-72" />;
}
