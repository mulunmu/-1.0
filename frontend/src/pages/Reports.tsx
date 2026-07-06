import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as echarts from "echarts";
import {
  Search,
  Download,
  FileText,
  Eye,
  Star,
  X,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Filter,
  RefreshCw,
  Plus,
  Building2,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyBlock, ErrorBlock } from "@/components/StateViews";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { fetchEnterprises, getInstantEnterprises } from "@/lib/dataSource";
import {
  generateReport,
  downloadReport,
  getEnterprise,
  type EnterpriseAssessment,
} from "@/lib/api";
import {
  CREDIT_LEVEL_COLORS,
  DIMENSION_LABELS,
  DIM_KEYS,
  RISK_LEVEL_COLORS,
} from "@/lib/labels";
import { CHART_THEME, RISK_CHART_COLORS } from "@/lib/theme";
import { cn } from "@/lib/utils";

/* ──────────────── 类型 ──────────────── */

interface ReportItem {
  id: string;
  enterpriseId: string;
  enterpriseName: string;
  riskLevel: string;
  overallScore: number;
  creditLevel: string;
  dimensions: Record<string, number>;
  createdAt: string;
  industry?: string;
  favorited: boolean;
}

type ViewMode = "grid" | "table";

import { buildMockReports, getMockEnterprise } from "@/lib/mockEnterprises";

/* ──────────────── 模拟报告数据（已提取到 lib/mockEnterprises.ts） ──────────────── */

/* ──────────────── 迷你雷达图 ──────────────── */

function MiniRadar({ data }: { data: Record<string, number> }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current ??= echarts.init(chartRef.current, undefined, {
      renderer: "canvas",
    });
    instanceRef.current.setOption({
      backgroundColor: "transparent",
      radar: {
        indicator: DIM_KEYS.map((k) => ({
          name: DIMENSION_LABELS[k].slice(0, 2),
          max: 100,
        })),
        center: ["50%", "50%"],
        radius: "55%",
        axisName: { color: CHART_THEME.axisLabel, fontSize: 8 },
        splitLine: { lineStyle: { color: CHART_THEME.splitLine } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
      },
      series: [
        {
          type: "radar",
          symbol: "none",
          data: [
            {
              value: DIM_KEYS.map((k) => data[k] ?? 0),
              lineStyle: { color: CHART_THEME.radar.line, width: 1 },
              itemStyle: { color: CHART_THEME.radar.item },
            },
          ],
        },
      ],
    });
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [data]);

  return <div ref={chartRef} className="w-full h-full" />;
}

/* ──────────────── 迷你进度条 ──────────────── */

function MiniBars({ dimensions }: { dimensions: Record<string, number> }) {
  return (
    <div className="space-y-1">
      {DIM_KEYS.map((k) => {
        const score = dimensions[k] ?? 0;
        const barW = Math.max(2, Math.min(100, score));
        return (
          <div key={k} className="flex items-center gap-1.5">
            <span className="text-[9px] text-neutral-600 w-8 shrink-0 text-right">
              {DIMENSION_LABELS[k].slice(0, 2)}
            </span>
            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200 ease-out"
                style={{
                  width: `${barW}%`,
                  background:
                    score >= 80
                      ? RISK_CHART_COLORS["低风险"]
                      : score >= 65
                        ? RISK_CHART_COLORS["中低风险"]
                        : score >= 50
                          ? RISK_CHART_COLORS["中等风险"]
                          : score >= 35
                            ? RISK_CHART_COLORS["中高风险"]
                            : RISK_CHART_COLORS["高风险"],
                }}
              />
            </div>
            <span className="text-[9px] font-mono text-neutral-500 w-6 shrink-0">
              {score.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}


/* ──────────────── 分页 ──────────────── */

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-white/[0.08] text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] hover:border-white/[0.14] active:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
      >
        <ChevronLeft size={14} />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`dots-${i}`}
            className="w-8 h-8 flex items-center justify-center text-neutral-600 text-xs"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p as number)}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-md text-xs font-mono transition-colors duration-200 ease-out",
              p === page
                ? "bg-white/[0.08] text-neutral-200 border border-white/[0.12]"
                : "text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.04] border border-transparent",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-white/[0.08] text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] hover:border-white/[0.14] active:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 ease-out"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

/* ──────────────── 骨架屏 ──────────────── */

function ReportsSkeleton({ view }: { view: ViewMode }) {
  if (view === "table") {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <Skeleton key={i} className="min-h-[10rem] rounded-lg sm:min-h-[12rem]" />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════ */

const PAGE_SIZE = 12;

export default function Reports() {
  const navigate = useNavigate();

  const [reports, setReports] = useState<ReportItem[]>(() =>
    buildMockReports(getInstantEnterprises()),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("mock");
  const dataSourceRef = useRef(dataSource);
  dataSourceRef.current = dataSource;

  // 尝试加载真实报告列表
  useEffect(() => {
    import("@/lib/apiClient").then(({ default: api }) => {
      api.get("/report/list", { timeout: 3000 })
        .then(async ({ data }: { data: { items?: { report_id: string; enterprise_id: string; date: string }[] } }) => {
          if (data?.items && data.items.length > 0) {
            const { getMockEnterprise } = await import("@/lib/mockEnterprises");
            setReports(data.items.map((r) => {
              const ent = getMockEnterprise(r.enterprise_id);
              return {
                id: r.report_id,
                enterpriseId: r.enterprise_id,
                enterpriseName: ent?.enterprise_name ?? r.enterprise_id,
                createdAt: r.date,
                overallScore: ent?.overall_score ?? 0,
                riskLevel: ent?.risk_level ?? "-",
                creditLevel: ent?.credit_level ?? "-",
                dimensions: ent?.dimensions ?? ({} as Record<string, number>),
                favorited: false,
              } as ReportItem;
            }));
            setDataSource("live");
          }
        }).catch(() => { /* keep mock */ });
    });
  }, []);

  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("全部");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewEnt, setPreviewEnt] = useState<EnterpriseAssessment | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { toast, showToast, closeToast } = useToast();

  /* ── 数据加载 ── */

  const load = useCallback(async () => {
    // 使用 ref 避免 stale closure：dataSource 更新后 load() 仍能读到最新值
    if (dataSourceRef.current === "live") return;
    setError(null);
    try {
      const ents = await fetchEnterprises();
      if (dataSourceRef.current === "live") return;
      const rpts = buildMockReports(ents);
      setReports(rpts);
      setFavorites(new Set(rpts.filter((r) => r.favorited).map((r) => r.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "报告加载失败");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ── 筛选 + 分页 ── */

  const filtered = useMemo(() => {
    let list = reports;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.enterpriseName.toLowerCase().includes(q) ||
          r.enterpriseId.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      );
    }
    if (riskFilter !== "全部") {
      list = list.filter((r) => r.riskLevel === riskFilter);
    }
    return list;
  }, [reports, search, riskFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  /* 筛选变化时重置页码 */
  useEffect(() => {
    setPage(1);
  }, [search, riskFilter]);

  /* ── 选择 ── */

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paged.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paged.map((r) => r.id)));
    }
  };

  /* ── 收藏 ── */

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        showToast("已取消收藏", "info");
      } else {
        next.add(id);
        showToast("已加入收藏", "success");
      }
      return next;
    });
  };

  /* ── 预览 ── */

  const openPreview = useCallback(
    async (report: ReportItem) => {
      setPreviewId(report.id);
      setPreviewLoading(true);
      try {
        // 优先调用真实 API，失败回退 mock 查找
        let ent: EnterpriseAssessment | undefined;
        try {
          ent = await getEnterprise(report.enterpriseId);
        } catch {
          ent = getMockEnterprise(report.enterpriseId) as unknown as EnterpriseAssessment;
        }
        setPreviewEnt({
          enterprise_id: report.enterpriseId,
          enterprise_name: ent?.enterprise_name ?? report.enterpriseName,
          credit_level: ent?.credit_level ?? report.creditLevel,
          tax_on_time_rate: ent?.tax_on_time_rate ?? 0.9,
          invoice_monthly_avg: ent?.invoice_monthly_avg ?? 0,
          revenue_deviation: ent?.revenue_deviation ?? 0,
          social_trend: ent?.social_trend ?? "稳定",
          industry_l1: report.industry ?? "制造业",
          overall_score: report.overallScore,
          risk_level: report.riskLevel,
          dimensions: report.dimensions as Record<
            string,
            number
          > & {
            tax_health: number;
            authenticity: number;
            industry: number;
            legal: number;
            finance: number;
          },
          dimension_details: {},
          warning_signals: [],
        } as EnterpriseAssessment);
      } finally {
        setPreviewLoading(false);
      }
    },
    [],
  );

  const closePreview = () => {
    setPreviewId(null);
    setPreviewEnt(null);
  };

  /* ── 导出 ── */

  const handleExport = async (report: ReportItem) => {
    showToast(`正在导出 ${report.enterpriseName} 报告…`, "info");
    try {
      const { report_id } = await generateReport(report.enterpriseId);
      await downloadReport(report_id, `${report.enterpriseName}_评估报告.pdf`);
      showToast("报告已导出", "success");
    } catch {
      showToast("导出失败，请重试", "info");
    }
  };

  const handleBatchExport = async () => {
    const toExport = reports.filter((r) => selected.has(r.id));
    if (toExport.length === 0) return;
    showToast(`正在批量导出 ${toExport.length} 份报告…`, "info");
    for (const r of toExport) {
      try {
        const { report_id } = await generateReport(r.enterpriseId);
        await downloadReport(report_id, `${r.enterpriseName}_评估报告.pdf`);
      } catch {
        // continue
      }
    }
    showToast(`已导出 ${toExport.length} 份报告`, "success");
    setSelected(new Set());
  };

  /* ── 预览用雷达图 ── */

  const previewRadarRef = useRef<HTMLDivElement>(null);
  const previewRadarInst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!previewRadarRef.current || !previewEnt) return;
    previewRadarInst.current ??= echarts.init(previewRadarRef.current, undefined, {
      renderer: "canvas",
    });
    previewRadarInst.current.setOption({
      backgroundColor: "transparent",
      radar: {
        indicator: DIM_KEYS.map((k) => ({
          name: DIMENSION_LABELS[k],
          max: 100,
        })),
        center: ["50%", "52%"],
        radius: "58%",
        axisName: {
          color: CHART_THEME.axisLabel,
          fontSize: 10,
          fontFamily: "Inter, sans-serif",
        },
        splitLine: { lineStyle: { color: CHART_THEME.splitLine } },
        splitArea: { areaStyle: { color: CHART_THEME.splitArea } },
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
      },
      series: [
        {
          type: "radar",
          symbol: "circle",
          symbolSize: 3,
          data: [
            {
              value: DIM_KEYS.map((k) => previewEnt.dimensions[k]),
              name: previewEnt.enterprise_name,
              lineStyle: {
                color: CHART_THEME.radar.line,
                width: 1.5,
              },
              itemStyle: { color: CHART_THEME.radar.item },
            },
          ],
        },
      ],
    });
    return () => {
      previewRadarInst.current?.dispose();
      previewRadarInst.current = null;
    };
  }, [previewEnt]);

  /* ── 加载 / 错误 ── */

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Skeleton className="h-6 w-40 rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ReportsSkeleton view={view} />
        </div>
      </div>
    );
  }

  if (error) return <ErrorBlock message={error} onRetry={load} />;

  /* ══════════════════════════════════════
     渲染
     ══════════════════════════════════════ */

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div data-reveal className="shrink-0">
      {/* ═══ 顶部控制栏 ═══ */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-100">
            评估报告中心
          </h1>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            生成 · 预览 · 导出 · 归档
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 搜索 */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索企业或编号…"
              className="w-36 sm:w-44 h-8 text-xs pl-7 border-white/[0.1] bg-white/[0.03]"
            />
          </div>

          {/* 风险筛选 */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="h-8 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 text-xs text-neutral-300 outline-none focus:border-blue-500/40 transition-colors duration-200 ease-out"
          >
            <option value="全部">全部风险</option>
            <option value="高风险">高风险</option>
            <option value="中高风险">中高风险</option>
            <option value="中等风险">中等风险</option>
            <option value="中低风险">中低风险</option>
            <option value="低风险">低风险</option>
          </select>

          {/* 批量导出 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchExport}
            disabled={selected.size === 0}
            className={cn(
              "h-8 border-white/[0.1] text-xs gap-1.5 transition-colors duration-200 ease-out",
              selected.size > 0
                ? "border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/50"
                : "hover:bg-white/[0.06] hover:border-white/[0.18]",
            )}
          >
            <Download size={13} />
            批量导出
            {selected.size > 0 && (
              <span className="font-mono text-[10px]">({selected.size})</span>
            )}
          </Button>

          {/* 新建报告 */}
          <Button
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="h-8 text-xs gap-1.5"
          >
            <Plus size={13} />
            新建评估
          </Button>

          {/* 视图切换 */}
          <div className="flex rounded-lg border border-white/[0.1] overflow-hidden">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "px-2 py-1.5 transition-colors duration-200 ease-out",
                view === "grid"
                  ? "bg-white/[0.08] text-neutral-200"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]",
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "px-2 py-1.5 transition-colors duration-200 ease-out",
                view === "table"
                  ? "bg-white/[0.08] text-neutral-200"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]",
              )}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* ═══ 统计摘要 ── */}
      <div data-reveal className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <FileText size={12} />
          共 {filtered.length} 份报告
        </span>
        {riskFilter !== "全部" && (
          <span className="flex items-center gap-1 text-neutral-400">
            <Filter size={11} />
            {riskFilter}
          </span>
        )}
        {search.trim() && (
          <span className="text-neutral-400">
            搜索：「{search.trim()}」
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setRiskFilter("全部");
          }}
          className="ml-auto text-neutral-600 hover:text-neutral-400 flex items-center gap-1 transition-colors duration-200 ease-out"
        >
          <RefreshCw size={11} />
          重置
        </button>
      </div>

      {/* ═══ 主体：网格 / 表格 ── */}
      <div data-reveal className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {filtered.length === 0 ? (
        <EmptyBlock message="暂无匹配的报告记录" />
      ) : view === "grid" ? (
        /* ── 网格视图 ── */
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-1">
            {paged.map((report) => {
              const isSel = selected.has(report.id);
              const isFav = favorites.has(report.id);

              return (
                <Card
                  key={report.id}
                  className={cn(
                    "rounded-lg group/card transition-colors duration-200",
                    "hover:bg-white/[0.03] hover:border-white/[0.12]",
                    isSel && "border-blue-500/30 bg-blue-500/[0.03]",
                  )}
                >
                  <CardContent className="pt-4 space-y-3">
                    {/* 选择 + 标题 */}
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelect(report.id)}
                        className="shrink-0 mt-0.5 text-neutral-600 hover:text-neutral-300 transition-colors duration-200 ease-out"
                      >
                        {isSel ? (
                          <CheckSquare size={15} className="text-blue-400" />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-neutral-200 truncate">
                          {report.enterpriseName}
                        </h3>
                        <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                          {report.id}
                        </p>
                      </div>
                    </div>

                    {/* 风险标签 + 日期 */}
                    <div className="flex items-center justify-between">
                      <Badge
                        className={cn(
                          "text-[10px]",
                          RISK_LEVEL_COLORS[report.riskLevel] ??
                            RISK_LEVEL_COLORS["中等风险"],
                        )}
                      >
                        {report.riskLevel}
                      </Badge>
                      <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                        <Calendar size={10} />
                        {report.createdAt}
                      </span>
                    </div>

                    {/* 迷你进度条 */}
                    <MiniBars dimensions={report.dimensions} />

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => openPreview(report)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 rounded-md py-1.5",
                          "text-[10px] text-neutral-500",
                          "hover:text-neutral-200 hover:bg-white/[0.06]",
                          "active:bg-white/[0.08]",
                          "transition-colors duration-200 ease-out",
                        )}
                      >
                        <Eye size={12} />
                        预览
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExport(report)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 rounded-md py-1.5",
                          "text-[10px] text-neutral-500",
                          "hover:text-neutral-200 hover:bg-white/[0.06]",
                          "active:bg-white/[0.08]",
                          "transition-colors duration-200 ease-out",
                        )}
                      >
                        <Download size={11} />
                        导出
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(report.id)}
                        className={cn(
                          "flex items-center justify-center rounded-md w-7 h-7",
                          "transition-colors duration-200 ease-out",
                          isFav
                            ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                            : "text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.06]",
                        )}
                      >
                        <Star
                          size={13}
                          fill={isFav ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      ) : (
        /* ── 表格视图 ── */
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="rounded-lg border border-white/[0.06] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="w-8 py-2.5 px-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-neutral-600 hover:text-neutral-300 transition-colors duration-200 ease-out"
                    >
                      {selected.size === paged.length && paged.length > 0 ? (
                        <CheckSquare size={14} className="text-blue-400" />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </th>
                  <th className="text-left py-2.5 px-3 text-neutral-500 font-medium">
                    报告编号
                  </th>
                  <th className="text-left py-2.5 px-3 text-neutral-500 font-medium">
                    企业名称
                  </th>
                  <th className="text-left py-2.5 px-3 text-neutral-500 font-medium">
                    风险等级
                  </th>
                  <th className="text-left py-2.5 px-3 text-neutral-500 font-medium hidden sm:table-cell">
                    综合评分
                  </th>
                  <th className="text-left py-2.5 px-3 text-neutral-500 font-medium hidden md:table-cell">
                    生成日期
                  </th>
                  <th className="text-right py-2.5 px-3 text-neutral-500 font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((report) => {
                  const isSel = selected.has(report.id);
                  const isFav = favorites.has(report.id);
                  return (
                    <tr
                      key={report.id}
                      className={cn(
                        "border-b border-white/[0.03] transition-colors duration-200 ease-out",
                        "hover:bg-white/[0.03]",
                        isSel && "bg-blue-500/[0.03]",
                      )}
                    >
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => toggleSelect(report.id)}
                          className="text-neutral-600 hover:text-neutral-300 transition-colors duration-200 ease-out"
                        >
                          {isSel ? (
                            <CheckSquare size={14} className="text-blue-400" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-400">
                        {report.id}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-200 truncate max-w-[160px]">
                        {report.enterpriseName}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          className={cn(
                            "text-[10px]",
                            RISK_LEVEL_COLORS[report.riskLevel] ??
                              RISK_LEVEL_COLORS["中等风险"],
                          )}
                        >
                          {report.riskLevel}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-300 hidden sm:table-cell">
                        {report.overallScore.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500 hidden md:table-cell">
                        {report.createdAt}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openPreview(report)}
                            className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors duration-200 ease-out"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExport(report)}
                            className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors duration-200 ease-out"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(report.id)}
                            className={cn(
                              "p-1.5 rounded transition-colors duration-200 ease-out",
                              isFav
                                ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                                : "text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.06]",
                            )}
                          >
                            <Star
                              size={12}
                              fill={isFav ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
      </div>

      {/* ═══ 预览弹窗 ═══ */}
      {previewId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closePreview}
        >
          <div
            className={cn(
              "w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border border-white/[0.1] bg-[var(--color-bg-surface)] p-5 sm:p-6",
              "animate-[fadeIn_200ms_ease-out]",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-neutral-100">
                  {(() => {
                    const rpt = reports.find((r) => r.id === previewId);
                    return rpt?.enterpriseName ?? "报告预览";
                  })()}
                </h2>
                <p className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                  {previewId}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="rounded-md p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors duration-200 ease-out"
              >
                <X size={16} />
              </button>
            </div>

            {previewLoading ? (
              <div className="space-y-4 py-8">
                <Skeleton className="h-8 w-32 mx-auto rounded-md" />
                <Skeleton className="h-48 w-full max-w-[320px] mx-auto rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            ) : previewEnt ? (
              <div className="space-y-5">
                {/* 总分 + 风险 */}
                <div className="flex flex-col items-center">
                  <p
                    className="text-4xl font-bold font-mono tabular-nums leading-none"
                    style={{
                      color:
                        RISK_CHART_COLORS[previewEnt.risk_level] ??
                        RISK_CHART_COLORS["中等风险"],
                    }}
                  >
                    {previewEnt.overall_score.toFixed(0)}
                  </p>
                  <Badge
                    className={cn(
                      "mt-2 text-xs",
                      RISK_LEVEL_COLORS[previewEnt.risk_level] ??
                        RISK_LEVEL_COLORS["中等风险"],
                    )}
                  >
                    {previewEnt.risk_level}
                  </Badge>
                </div>

                {/* 雷达图 */}
                <div className="w-full max-w-[300px] mx-auto h-56">
                  <div ref={previewRadarRef} className="w-full h-full" />
                </div>

                {/* 企业基础信息 */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={14} className="text-neutral-500" />
                    <span className="text-xs font-medium text-neutral-400">
                      企业信息
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-500">行业：</span>
                      <span className="text-neutral-300">
                        {previewEnt.industry_l1 ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">信用等级：</span>
                      <span className="text-neutral-300 font-mono">
                        {previewEnt.credit_level}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">纳税准时率：</span>
                      <span className="text-neutral-300 font-mono">
                        {(previewEnt.tax_on_time_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">营收偏差：</span>
                      <span className="text-neutral-300 font-mono">
                        {(previewEnt.revenue_deviation * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 弹窗底部操作 */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closePreview}
                    className="border-white/[0.1] text-xs hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors duration-200 ease-out"
                  >
                    关闭
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const rpt = reports.find(
                        (r) => r.id === previewId,
                      );
                      if (rpt) handleExport(rpt);
                    }}
                    className="text-xs gap-1.5"
                  >
                    <Download size={13} />
                    导出 PDF
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-8">
                无法加载报告详情
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══ Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
    </div>
  );
}
