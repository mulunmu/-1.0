import { useState, useCallback } from "react";

interface ToastState {
  message: string;
  type: "success" | "info" | "error";
}

/** 全局 Toast 钩子 — 单例模式，自动排队 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "info" | "error" = "info") => {
      setToast({ message, type });
    },
    [],
  );

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, closeToast };
}
