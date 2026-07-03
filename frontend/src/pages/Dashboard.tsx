import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot } from "lucide-react";
import SearchBox from "@/components/SearchBox";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllEnterprises, type EnterpriseAssessment } from "@/lib/api";
import { CREDIT_LEVEL_COLORS, RISK_LEVEL_COLORS, RISK_LEVEL_TEXT } from "@/lib/labels";

export default function Dashboard() {
  const navigate = useNavigate();
  const [enterprises, setEnterprises] = useState<EnterpriseAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllEnterprises();
      setEnterprises(data.sort((a, b) => b.overall_score - a.overall_score));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-slate-800 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">企业风险评估系统</h1>
              <p className="mt-1 text-sm text-slate-400">三维评分 · 实时预警 · 智能分析</p>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link to="/chat">
                <Bot className="h-4 w-4" />
                AI 分析
              </Link>
            </Button>
          </div>
          {!loading && !error && enterprises.length > 0 && (
            <SearchBox enterprises={enterprises} />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-200">企业概览</h2>
          <span className="text-sm text-slate-500">共 10 家样本企业</span>
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="border-slate-800">
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && error && <ErrorBlock message={error} onRetry={load} />}

        {!loading && !error && enterprises.length === 0 && (
          <EmptyBlock message="暂无企业数据" />
        )}

        {!loading && !error && enterprises.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {enterprises.map((ent) => (
              <Card
                key={ent.enterprise_id}
                className="cursor-pointer border-slate-800 transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5"
                onClick={() => navigate(`/enterprise/${ent.enterprise_id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="line-clamp-2 text-base leading-snug">
                    {ent.enterprise_name}
                  </CardTitle>
                  <p className="text-xs text-slate-500">{ent.enterprise_id}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={CREDIT_LEVEL_COLORS[ent.credit_level] ?? CREDIT_LEVEL_COLORS.M}>
                      信用 {ent.credit_level}
                    </Badge>
                    <Badge className={RISK_LEVEL_COLORS[ent.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}>
                      {ent.risk_level}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">综合评分</p>
                    <p className={`text-3xl font-bold tabular-nums ${RISK_LEVEL_TEXT[ent.risk_level] ?? "text-slate-200"}`}>
                      {ent.overall_score.toFixed(1)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        当前为模拟数据演示版本，所有企业及评分均为随机生成，不反映真实情况
      </footer>
    </div>
  );
}
