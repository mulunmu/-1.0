import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRiskWarnings, type RiskWarningItem } from "@/lib/api";
import {
  RISK_LEVEL_COLORS,
  RISK_LEVEL_FILTER_OPTIONS,
  RISK_LEVEL_TEXT,
  WARNING_SIGNAL_LABELS,
  WARNING_SEVERITY_STYLES,
} from "@/lib/labels";

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

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "全部") return items;
    return items.filter((item) => item.risk_level === filter);
  }, [items, filter]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </Button>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">风险预警清单</h1>
            <p className="mt-1 text-sm text-slate-400">展示所有触发预警信号的企业</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="risk-filter" className="text-sm text-slate-400">
              风险等级
            </label>
            <select
              id="risk-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RISK_LEVEL_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <LoadingBlock />}
        {!loading && error && <ErrorBlock message={error} onRetry={load} />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyBlock
            message={filter === "全部" ? "当前无预警企业" : `暂无「${filter}」级别的预警企业`}
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <Card className="border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">
                共 {filtered.length} 家企业存在预警
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-slate-500">
                    <th className="px-5 py-3 font-medium">企业名称</th>
                    <th className="px-5 py-3 font-medium">风险等级</th>
                    <th className="px-5 py-3 font-medium">综合分</th>
                    <th className="px-5 py-3 font-medium">触发信号</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.enterprise_id}
                      className="cursor-pointer border-b border-slate-800/60 transition-colors hover:bg-slate-800/40"
                      onClick={() => navigate(`/enterprise/${item.enterprise_id}`)}
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-200">{item.enterprise_name}</p>
                        <p className="text-xs text-slate-500">{item.enterprise_id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={RISK_LEVEL_COLORS[item.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}>
                          {item.risk_level}
                        </Badge>
                      </td>
                      <td className={`px-5 py-4 font-bold tabular-nums ${RISK_LEVEL_TEXT[item.risk_level] ?? ""}`}>
                        {item.overall_score.toFixed(1)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {item.warning_signals.map((signal) => {
                            const meta = WARNING_SIGNAL_LABELS[signal] ?? {
                              label: signal,
                              severity: "yellow" as const,
                            };
                            return (
                              <Badge
                                key={signal}
                                className={`text-xs font-normal ${WARNING_SEVERITY_STYLES[meta.severity]}`}
                              >
                                {meta.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
