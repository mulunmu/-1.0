import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginFormProps {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
}

export default function LoginForm({
  email, password, error, loading,
  onEmailChange, onPasswordChange, onSubmit,
}: LoginFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] text-[var(--color-fg-subtle)] tracking-[0.22em] uppercase mb-6">
        System Access
      </p>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="text-[10px] text-[var(--color-fg-muted)] tracking-wider mb-2 block uppercase"
          >
            邮箱
          </label>
          <Input
            id="login-email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="h-11 backdrop-blur-none bg-[var(--color-bg-elevated)] border-[var(--border-subtle)]"
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="text-[10px] text-[var(--color-fg-muted)] tracking-wider mb-2 block uppercase"
          >
            密码
          </label>
          <Input
            id="login-password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            type="password"
            className="h-11 backdrop-blur-none bg-[var(--color-bg-elevated)] border-[var(--border-subtle)]"
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          />
        </div>
      </div>

      <Button
        onClick={onSubmit}
        disabled={loading}
        className="w-full h-11 mt-7 font-medium"
      >
        {loading ? "验证中…" : "进入系统"}
      </Button>

      <p className="text-center text-[11px] text-[var(--color-fg-subtle)] mt-6">
        还没有账号？
        <Link
          to="/register"
          className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] ml-1 transition-colors duration-200 ease-out"
        >
          注册
        </Link>
      </p>

      {import.meta.env.DEV && (
        <p className="text-center text-[10px] text-neutral-600 mt-2">
          测试账号：任意邮箱 + 密码 ≥ 6 位
        </p>
      )}
    </div>
  );
}
