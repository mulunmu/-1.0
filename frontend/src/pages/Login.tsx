import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setToken } from "@/lib/auth";
import api, { ApiError } from "@/lib/api";
import CosmicBackground from "@/components/CosmicBackground";
import LoginBrandMark from "@/components/LoginBrandMark";
import LoginDeepSpace from "@/components/LoginDeepSpace";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post<{ access_token: string }>("/auth/login", { email, password });
      setToken(data.access_token);
      navigate("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 bg-[#161616]">
      <CosmicBackground />
      <LoginDeepSpace />

      <div className="relative z-10 w-full max-w-[440px] fade-in">
        <div className="glass-login p-10">
          <div className="flex flex-col items-center mb-10">
            <div className="mb-5 flex items-center justify-center w-16 h-16 rounded-2xl border border-white/10 bg-white/[0.03]">
              <LoginBrandMark size={52} />
            </div>
            <h1 className="text-[28px] font-light tracking-[0.08em] text-white">
              风险<span className="font-semibold">评估</span>
            </h1>
            <p className="text-[10px] tracking-[0.2em] text-neutral-500 mt-3">
              企业风险智能分析
            </p>
            <p className="text-xs text-neutral-600 mt-1">企业多维风险评估系统</p>
          </div>

          <div className="mono-divider mb-8 opacity-60" />

          {error && (
            <p className="text-sm text-red-400 bg-red-400/5 border border-red-400/20 p-3 rounded-lg mb-5 text-center">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[10px] tracking-[0.15em] text-neutral-500 mb-2 block">邮箱</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@test.com"
                className="bg-white/[0.04] border-white/10 focus:border-white/30 text-white h-12 rounded-lg placeholder:text-neutral-600"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.15em] text-neutral-500 mb-2 block">密码</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••"
                className="bg-white/[0.04] border-white/10 focus:border-white/30 text-white h-12 rounded-lg placeholder:text-neutral-600"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          </div>

          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-12 mt-8 bg-white text-black hover:bg-neutral-200 font-medium tracking-[0.1em] text-sm rounded-lg transition-all duration-300"
          >
            {loading ? "登录中..." : "进入系统"}
          </Button>

          <p className="text-center text-[11px] text-neutral-600 mt-8 leading-relaxed">
            还没有账号？
            <Link to="/register" className="text-neutral-400 hover:text-white transition-colors mx-1 underline-offset-4 hover:underline">
              注册
            </Link>
            <br />
            <span className="text-neutral-700 mt-1 inline-block">演示 · admin@test.com / 123456</span>
          </p>
        </div>

        <p className="text-center text-[10px] text-neutral-700 tracking-widest mt-6">
          安全加密传输 · v1.0
        </p>
      </div>
    </div>
  );
}
