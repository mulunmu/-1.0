import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RiskCard } from "@/components/ui/RiskCard";
import api, { ApiError } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import CosmicShaderBackground from "@/components/background/CosmicShaderBackground";

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");
    if (password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    if (password.length < 6) {
      setError("密码至少6位");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", { email, password });
      navigate(ROUTES.login, { state: { email } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-[1] min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <CosmicShaderBackground variant="login" fixed />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-[var(--color-fg)]">
            创建账号
          </h1>
          <p className="text-xs text-[var(--color-fg-subtle)] tracking-widest mt-3 uppercase">
            Join Risk Console
          </p>
        </div>

        <RiskCard className="p-8 sm:p-10">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-5 text-center">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              className="h-11 backdrop-blur-none bg-[var(--color-bg-elevated)] border-[var(--border-subtle)]"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="密码"
              className="h-11 backdrop-blur-none bg-[var(--color-bg-elevated)] border-[var(--border-subtle)]"
            />
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              placeholder="确认密码"
              className="h-11 backdrop-blur-none bg-[var(--color-bg-elevated)] border-[var(--border-subtle)]"
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />
          </div>

          <Button
            onClick={handleRegister}
            disabled={loading}
            className="w-full h-11 mt-6 font-medium"
          >
            {loading ? "注册中…" : "注册"}
          </Button>

          <p className="text-center text-[11px] text-[var(--color-fg-subtle)] mt-6">
            已有账号？
            <Link
              to={ROUTES.login}
              className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] ml-1 transition-colors duration-200 ease-out"
            >
              登录
            </Link>
          </p>
        </RiskCard>
      </div>
    </div>
  );
}
