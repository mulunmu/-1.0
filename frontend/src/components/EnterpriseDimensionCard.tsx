import { ChevronRight } from "lucide-react";
import { RISK_CHART_COLORS } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { DimKey } from "@/lib/labels";

function riskHint(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "优秀", color: "text-teal-400" };
  if (score >= 65) return { text: "良好", color: "text-slate-300" };
  if (score >= 50) return { text: "一般", color: "text-neutral-400" };
  if (score >= 35) return { text: "关注", color: "text-amber-400" };
  return { text: "预警", color: "text-rose-400" };
}

export default function EnterpriseDimensionCard({
  dimKey,
  score,
  label,
  detail,
  onClick,
}: {
  dimKey: DimKey;
  score: number;
  label: string;
  detail?: Record<string, unknown>;
  onClick?: () => void;
}) {
  const hint = riskHint(score);
  const barWidth = Math.max(4, Math.min(100, score));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-lg border border-white/[0.06]",
        "bg-white/[0.02] px-4 py-4",
        "transition-colors duration-200",
        "hover:bg-white/[0.05] hover:border-white/[0.1]",
        "active:bg-white/[0.07]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-neutral-300 tracking-wide">{label}</span>
        <ChevronRight size={14} className="text-neutral-600 group-hover:text-neutral-400 transition-colors duration-200" />
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-mono tabular-nums text-neutral-100">{score.toFixed(0)}</span>
        <span className={cn("text-[11px] font-medium", hint.color)}>{hint.text}</span>
      </div>

      <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200 ease-out"
          style={{
            width: `${barWidth}%`,
            background:
              score >= 80 ? RISK_CHART_COLORS["低风险"]
              : score >= 65 ? RISK_CHART_COLORS["中低风险"]
              : score >= 50 ? RISK_CHART_COLORS["中等风险"]
              : score >= 35 ? RISK_CHART_COLORS["中高风险"]
              : RISK_CHART_COLORS["高风险"],
          }}
        />
      </div>

      {detail && (
        <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-1">
          {Object.entries(detail).slice(0, 2).map(([k, v]) => (
            <p key={k} className="text-[10px] text-neutral-500 flex justify-between">
              <span className="truncate mr-2">{k}</span>
              <span className="font-mono shrink-0 text-neutral-400">{String(v)}</span>
            </p>
          ))}
        </div>
      )}
    </button>
  );
}
