import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateViews";
import WarningSignalBadge from "@/components/WarningSignalBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getRiskWarnings, type RiskWarningItem } from "@/lib/api";
import {
  RISK_LEVEL_COLORS,
  RISK_LEVEL_FILTER_OPTIONS,
  RISK_LEVEL_TEXT,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

const FILTER_CHIP_COLORS: Record<string, string> = {
  全部: "border-white/15 text-neutral-300 bg-white/[0.06]",
  高风险: "border-red-500/40 text-red-300 bg-red-500/10",
  中高风险: "border-red-400/30 text-red-400 bg-red-500/10",
  中等风险: "border-amber-500/35 text-amber-400 bg-amber-500/10",
  中低风险: "border-blue-400/30 text-blue-400 bg-blue-500/10",
  低风险: "border-emerald-400/30 text-emerald-400 bg-emerald-500/8",
};

export default function RiskWarnings() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RiskWarningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("全部");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getRiskWarnings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === "全部") return items;
    return items.filter((item) => item.risk_level === filter);
  }, [items, filter]);

  return (
    <div className="w-full space-y-4 fade-in pb-6">
      <div className="flex flex-wrap gap-1.5">
        {RISK_LEVEL_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs transition-colors",
              filter === opt.value
                ? "border-white/25 bg-white/[0.1] text-white"
                : FILTER_CHIP_COLORS[opt.value] ?? "border-white/10 text-neutral-400 bg-white/[0.03] hover:bg-white/[0.06] hover:text-neutral-200",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={load} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyBlock message={filter === "全部" ? "当前无预警企业" : `暂无「${filter}」级别的预警企业`} />
      )}

      {!loading && !error && filtered.length > 0 && (
        <Card className="glass">
          <CardContent className="p-0 sm:p-0">
            {/* 桌面端表格 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-neutral-500">
                    <th className="w-[28%] px-5 py-3 font-medium">企业名称</th>
                    <th className="w-[12%] px-5 py-3 font-medium">风险等级</th>
                    <th className="w-[10%] px-5 py-3 font-medium">综合分</th>
                    <th className="w-[50%] px-5 py-3 font-medium">触发信号</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.enterprise_id}
                      className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                      onClick={() => navigate(`/enterprise/${item.enterprise_id}`)}
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-neutral-200 break-words">{item.enterprise_name}</p>
                        <p className="text-xs text-neutral-600 mt-0.5">{item.enterprise_id}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <Badge className={cn("shrink-0", RISK_LEVEL_COLORS[item.risk_level] ?? RISK_LEVEL_COLORS["高风险"])}>{item.risk_level}</Badge>
                      </td>
                      <td className={`px-5 py-4 align-top font-bold tabular-nums ${RISK_LEVEL_TEXT[item.risk_level] ?? ""}`}>{item.overall_score.toFixed(1)}</td>
                      <td className="px-5 py-4 align-top max-w-0">
                        <div className="flex flex-wrap items-start gap-1.5">
                          {item.warning_signals.map((signal) => (
                            <WarningSignalBadge key={signal} signal={signal} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端卡片列表 */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {filtered.map((item) => (
                <button
                  key={item.enterprise_id}
                  type="button"
                  className="w-full text-left px-4 py-4 hover:bg-white/[0.03] transition-colors"
                  onClick={() => navigate(`/enterprise/${item.enterprise_id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-200 truncate">{item.enterprise_name}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">{item.enterprise_id}</p>
                    </div>
                    <Badge className={RISK_LEVEL_COLORS[item.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}>{item.risk_level}</Badge>
                  </div>
                  <p className={`text-xl font-bold tabular-nums mt-2 ${RISK_LEVEL_TEXT[item.risk_level] ?? ""}`}>{item.overall_score.toFixed(1)}</p>
                  <div className="flex flex-wrap items-start gap-1.5 mt-3">
                    {item.warning_signals.map((signal) => (
                      <WarningSignalBadge key={signal} signal={signal} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
