import { WARNING_SIGNAL_LABELS, WARNING_SEVERITY_STYLES } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default function WarningSignalBadge({
  signal,
  className,
}: {
  signal: string;
  className?: string;
}) {
  const meta = WARNING_SIGNAL_LABELS[signal] ?? { label: signal, severity: "yellow" as const };
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[10px] sm:text-xs font-normal leading-snug",
        WARNING_SEVERITY_STYLES[meta.severity],
        className,
      )}
    >
      <span className="truncate">{meta.label}</span>
    </span>
  );
}
