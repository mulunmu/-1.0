import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "risk-demo-banner-dismissed";
const HIDE_MS = 24 * 60 * 60 * 1000;

export default function MockDataBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const dismissedAt = Number(raw);
      if (!Number.isNaN(dismissedAt) && Date.now() - dismissedAt < HIDE_MS) {
        return;
      }
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <div className="relative flex items-center justify-center gap-3 bg-amber-500/90 px-4 py-2 text-sm text-amber-950">
      <span>演示版本 · 模拟数据 · 不构成任何参考意见</span>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 rounded p-1 hover:bg-amber-600/30"
        aria-label="关闭提示"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
