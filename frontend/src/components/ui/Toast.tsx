import { useEffect } from "react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  message: string;
  type?: "success" | "info" | "error";
  onClose: () => void;
  duration?: number;
}

/** 全局轻提示 — 8px 圆角 · 单色边框 · 2s 自动消失 */
export function Toast({ message, type = "info", onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-lg fade-in",
        type === "success" &&
          "border-teal-500/30 bg-teal-500/10 text-teal-300",
        type === "error" &&
          "border-rose-500/30 bg-rose-500/10 text-rose-300",
        type === "info" &&
          "border-white/[0.12] bg-[var(--color-bg-surface)] text-neutral-200",
      )}
    >
      {message}
    </div>
  );
}
