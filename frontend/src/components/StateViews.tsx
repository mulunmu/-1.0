import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingBlock() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 sm:py-16 text-neutral-500">
      <RefreshCw className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-neutral-400" />
      <p className="text-sm">数据加载中...</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 sm:py-16 text-center px-4">
      <AlertCircle className="h-9 w-9 sm:h-10 sm:w-10 text-red-400" />
      <p className="max-w-md text-sm text-neutral-400">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="border-white/15">
          <RefreshCw className="h-4 w-4" />
          重试
        </Button>
      )}
    </div>
  );
}

export function EmptyBlock({ message = "暂无数据" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 sm:py-16 text-neutral-500 px-4">
      <Inbox className="h-9 w-9 sm:h-10 sm:w-10" />
      <p className="text-sm text-center">{message}</p>
    </div>
  );
}
