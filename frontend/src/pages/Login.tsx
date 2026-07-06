import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RiskCard } from "@/components/ui/RiskCard";
import LoginForm from "@/components/LoginForm";
import CosmicBrandText from "@/components/ui/CosmicBrandText";
import { setToken } from "@/lib/auth";
import api, { ApiError } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import CosmicShaderBackground from "@/components/background/CosmicShaderBackground";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string } | null;

  const [email, setEmail] = useState(state?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post<{ access_token: string }>("/auth/login", {
        email,
        password,
      });
      setToken(data.access_token);
      setExiting(true);
      setTimeout(() => navigate(ROUTES.hub), 300);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "登录失败");
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "relative z-[1] isolate min-h-screen flex flex-col lg:flex-row overflow-hidden",
        "transition-opacity duration-300 ease-out",
        exiting && "opacity-0 pointer-events-none",
      )}
    >
      <CosmicShaderBackground variant="login" fixed />

      {/* 左侧：标题位于光带展开区 */}
      <div className="relative z-10 flex-[0.42] flex flex-col justify-center py-12 px-8 sm:px-10 lg:px-14 max-lg:items-center max-lg:text-center">
        <CosmicBrandText
          title="企业风险评估系统"
          lead="多维评分 · 关系网络 · 智能预警"
          meta="200 家样本 · 五维风控模型"
          align="left"
          size="login"
          className="max-lg:items-center max-lg:[&_.cosmic-brand-title]:text-center"
        />
      </div>

      <div className="relative z-10 flex w-full lg:flex-[0.58] flex-col justify-center px-8 py-12">
        <RiskCard className="w-full max-w-[400px] mx-auto">
          <LoginForm
            email={email}
            password={password}
            error={error}
            loading={loading}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleLogin}
          />
        </RiskCard>
      </div>
    </div>
  );
}
