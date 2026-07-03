import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBox from "@/components/SearchBox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllEnterprises, type EnterpriseAssessment } from "@/lib/api";
import { RISK_LEVEL_COLORS } from "@/lib/labels";
import { riskGlowStyle } from "@/lib/theme";

export default function EnterpriseSearch() {
  const navigate = useNavigate();
  const [enterprises, setEnterprises] = useState<EnterpriseAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllEnterprises()
      .then(setEnterprises)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full space-y-4 fade-in pb-6">
      <SearchBox
        enterprises={enterprises}
        placeholder="企业名称或编号"
        className="w-full max-w-none"
      />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-24 glass" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3 max-h-[calc(100vh-12rem)] overflow-auto">
          {enterprises.map((e) => (
            <button
              key={e.enterprise_id}
              type="button"
              onClick={() => navigate(`/enterprise/${e.enterprise_id}`)}
              className="glass-card rounded-xl p-3 text-left min-w-0 group"
            >
              <p className="text-sm font-medium line-clamp-2 text-neutral-200 group-hover:text-white transition-colors leading-snug">
                {e.enterprise_name}
              </p>
              <div className="flex items-center justify-between mt-2.5 gap-1">
                <span className="text-lg font-bold font-mono tabular-nums" style={riskGlowStyle(e.risk_level)}>
                  {e.overall_score.toFixed(0)}
                </span>
                <Badge className={`text-[10px] shrink-0 ${RISK_LEVEL_COLORS[e.risk_level] ?? RISK_LEVEL_COLORS["高风险"]}`}>
                  {e.risk_level}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
