import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingBlock() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      <p className="text-sm">数据加载中...</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <AlertCircle className="h-10 w-10 text-red-400" />
      <p className="max-w-md text-sm text-slate-400">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          重试
        </Button>
      )}
    </div>
  );
}

export function EmptyBlock({ message = "暂无数据" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Inbox className="h-10 w-10" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
