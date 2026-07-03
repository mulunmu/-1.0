import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CosmicBackground from "@/components/CosmicBackground";
import api, { ApiError } from "@/lib/api";

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
      navigate("/login");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate min-h-screen flex items-center justify-center overflow-hidden px-4 bg-[#161616]">
      <CosmicBackground />

      <div className="relative z-10 w-full max-w-[440px] fade-in">
        <div className="mono-divider mb-8" />
        <div className="glass-login rounded-2xl p-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-light tracking-[0.06em] text-white">创建账号</h1>
            <p className="text-[10px] tracking-[0.2em] text-neutral-500 mt-2">填写信息完成注册</p>
          </div>
          <div className="mono-divider mb-8" />

          {error && (
            <p className="text-sm text-red-400 bg-red-400/5 border border-red-400/20 p-3 rounded-lg mb-5 text-center">{error}</p>
          )}

          <div className="space-y-4">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              className="bg-white/[0.04] border-white/10 focus:border-white/30 text-white h-12 rounded-lg placeholder:text-neutral-600"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="密码"
              className="bg-white/[0.04] border-white/10 focus:border-white/30 text-white h-12 rounded-lg placeholder:text-neutral-600"
            />
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              placeholder="确认密码"
              className="bg-white/[0.04] border-white/10 focus:border-white/30 text-white h-12 rounded-lg placeholder:text-neutral-600"
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />
          </div>

          <Button
            onClick={handleRegister}
            disabled={loading}
            className="w-full h-12 mt-8 bg-white text-black hover:bg-neutral-200 font-medium tracking-[0.1em] text-sm rounded-lg"
          >
            {loading ? "注册中..." : "注册"}
          </Button>

          <p className="text-center text-[11px] text-neutral-600 mt-8">
            已有账号？
            <Link to="/login" className="text-neutral-400 hover:text-white transition-colors ml-1 underline-offset-4 hover:underline">
              登录
            </Link>
          </p>
        </div>
        <div className="mono-divider mt-8" />
      </div>
    </div>
  );
}
