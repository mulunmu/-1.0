import { useNavigate } from "react-router-dom";
import SearchBox from "@/components/SearchBox";
import { Badge } from "@/components/ui/badge";
import { ErrorBlock } from "@/components/StateViews";
import { useEnterpriseCatalog } from "@/hooks/useEnterpriseCatalog";
import { RISK_LEVEL_COLORS } from "@/lib/labels";
import { RISK_CHART_COLORS } from "@/lib/theme";

export default function EnterpriseSearch() {
  const navigate = useNavigate();
  const { enterprises, syncing, error, reload } = useEnterpriseCatalog();

  const gridClass =
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3";

  if (error && enterprises.length === 0) {
    return <ErrorBlock message={error} onRetry={() => reload(true)} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 sm:gap-3">
      <div data-reveal className="flex items-center gap-3">
        <SearchBox
          enterprises={enterprises}
          placeholder="企业名称或编号"
          className="w-full max-w-none shrink-0"
        />
        {syncing && (
          <span className="text-[10px] text-neutral-600 animate-pulse shrink-0">
            同步中…
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto" data-reveal>
        <div className={gridClass}>
          {enterprises.map((e) => (
            <button
              key={e.enterprise_id}
              type="button"
              onClick={() => navigate(`/enterprise/${e.enterprise_id}`)}
              className="rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] p-3 sm:p-4 text-left min-w-0 min-h-[5.5rem] sm:min-h-[6rem] group transition-colors duration-200 ease-out hover:bg-white/[0.05]"
            >
              <p className="text-sm font-medium line-clamp-2 text-neutral-200 group-hover:text-white transition-colors leading-snug">
                {e.enterprise_name}
              </p>
              <div className="flex items-center justify-between mt-2.5 gap-1">
                <span
                  className="text-lg font-bold font-mono tabular-nums"
                  style={{
                    color: RISK_CHART_COLORS[e.risk_level] ?? RISK_CHART_COLORS["中等风险"],
                  }}
                >
                  {e.overall_score.toFixed(0)}
                </span>
                <Badge
                  className={`text-[10px] shrink-0 ${RISK_LEVEL_COLORS[e.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}`}
                >
                  {e.risk_level}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
