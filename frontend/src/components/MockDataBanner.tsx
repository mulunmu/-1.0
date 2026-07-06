import { useEffect, useState } from "react";
import { X, Database, Zap, Cpu } from "lucide-react";
import { resolveDataMode, getDataModeSync, type DataMode } from "@/lib/dataSource";

const STORAGE_KEY = "risk-demo-banner-dismissed";
const HIDE_MS = 24 * 60 * 60 * 1000;

const MODE_LABELS: Record<DataMode, { text: string; icon: typeof Database; color: string }> = {
  mock: { text: "模拟数据（离线模式）", icon: Database, color: "text-amber-400" },
  mock_with_llm: { text: "模拟数据 · AI 已接入", icon: Cpu, color: "text-blue-400" },
  live: { text: "真实数据 · AI 已接入", icon: Zap, color: "text-emerald-400" },
};

export default function MockDataBanner() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<DataMode>(() => getDataModeSync());

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const dismissedAt = Number(raw);
      if (!Number.isNaN(dismissedAt) && Date.now() - dismissedAt < HIDE_MS) return;
    }
    setVisible(true);
    resolveDataMode().then(setMode);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }

  const cfg = MODE_LABELS[mode] ?? MODE_LABELS.mock;
  const Icon = cfg.icon;

  return (
    <div className="relative flex shrink-0 items-center justify-center gap-3 bg-transparent border-b border-white/[0.06] px-4 py-2 text-xs text-neutral-400">
      <Icon size={12} className={cfg.color} />
      <span>{cfg.text}</span>
      {mode !== "live" && (
        <span className="text-[10px] text-neutral-600">
          · 真实数据导入后将自动切换
        </span>
      )}
      <button type="button" onClick={dismiss} className="absolute right-3 rounded p-1 hover:bg-white/10" aria-label="关闭提示">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
