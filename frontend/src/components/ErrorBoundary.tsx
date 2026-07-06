import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-deep)] p-6">
          <div className="max-w-md w-full rounded-lg border border-white/[0.08] bg-[var(--color-bg-surface)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
              <AlertTriangle className="h-7 w-7 text-rose-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-neutral-100">
              页面出现异常
            </h2>
            <p className="mb-2 text-sm text-neutral-500">
              {this.state.error?.message || "未知渲染错误"}
            </p>
            <p className="mb-6 text-xs text-neutral-600">
              请尝试刷新页面，或返回上一页重试
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-neutral-300 hover:bg-white/[0.06] transition-colors"
              >
                返回上页
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                <RefreshCw size={14} />
                重试
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
