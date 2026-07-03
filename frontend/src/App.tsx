import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Search, GitCompare, AlertTriangle, Share2,
  MessageSquare, FileText, LogOut, ChevronLeft, Menu, X,
} from "lucide-react";
import { useState, useEffect } from "react";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import EnterpriseDetail from "@/pages/EnterpriseDetail";
import EnterprisePK from "@/pages/EnterprisePK";
import RiskWarnings from "@/pages/RiskWarnings";
import ChatPanel from "@/pages/ChatPanel";
import NetworkGraph from "@/pages/NetworkGraph";
import EnterpriseSearch from "@/pages/EnterpriseSearch";
import Reports from "@/pages/Reports";
import { getToken, removeToken } from "@/lib/auth";
import CosmicBackground from "@/components/CosmicBackground";
import MockDataBanner from "@/components/MockDataBanner";
import SidebarNavIcon from "@/components/SidebarNavIcon";
import LoginBrandMark from "@/components/LoginBrandMark";
import { cn } from "@/lib/utils";

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { path: "/dashboard", label: "总览", icon: LayoutDashboard },
    { path: "/search", label: "企业查询", icon: Search },
    { path: "/pk?ids=ENT001,ENT002,ENT003", label: "企业对比", icon: GitCompare },
    { path: "/warnings", label: "风险预警", icon: AlertTriangle },
    { path: "/network", label: "交易网络", icon: Share2 },
    { path: "/chat", label: "智能分析", icon: MessageSquare },
    { path: "/reports", label: "报告中心", icon: FileText },
  ];

  const isActive = (p: string) => {
    const base = p.split("?")[0];
    return location.pathname === base || (base !== "/dashboard" && location.pathname.startsWith(base));
  };

  const currentLabel = menuItems.find((m) => isActive(m.path))?.label || "";

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const nav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const isChat = location.pathname.startsWith("/chat");
  const isNetwork = location.pathname.startsWith("/network");

  return (
    <div className="relative flex h-screen text-[#e2e8f0] overflow-hidden bg-[#161616]">
      <CosmicBackground />

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="关闭菜单"
          className="fixed inset-0 z-30 bg-black/70 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={cn(
          "bg-transparent border-r border-white/[0.06] rounded-none flex flex-col shrink-0 transition-all duration-300 z-40",
          "fixed md:relative inset-y-0 left-0 h-full pb-[env(safe-area-inset-bottom)]",
          collapsed ? "w-16" : "w-56",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center shrink-0">
              <LoginBrandMark size={collapsed ? 26 : 28} />
            </div>
            {!collapsed && (
              <span className="text-sm font-light tracking-[0.06em] text-white truncate">
                风险<span className="font-semibold">评估</span>
              </span>
            )}
          </div>
          <button
            type="button"
            className="md:hidden text-neutral-500 hover:text-white p-1"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => nav(item.path)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 text-sm rounded-xl transition-all duration-200",
                isActive(item.path)
                  ? "bg-white/[0.08] text-white border border-white/15"
                  : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200 border border-transparent",
              )}
            >
              <SidebarNavIcon icon={item.icon} active={isActive(item.path)} label={item.label} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex w-full items-center justify-center py-2 text-neutral-600 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} className={cn("transition-transform", collapsed && "rotate-180")} />
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={() => { removeToken(); navigate("/login"); }}
              className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-xs text-neutral-600 hover:text-red-400 transition-colors rounded-xl hover:bg-white/[0.04]"
            >
              <LogOut size={13} />
              <span>退出登录</span>
            </button>
          )}
        </div>
      </aside>

      {/* 主区域 */}
      <div className="relative flex flex-1 flex-col overflow-hidden min-w-0">
        <MockDataBanner />
        <header className="h-12 border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 shrink-0 bg-transparent gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden text-neutral-400 hover:text-white shrink-0"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-xs text-neutral-500 truncate">{currentLabel}</span>
          </div>
          <span className="text-[10px] text-neutral-600 bg-white/[0.04] border border-white/[0.08] px-2 py-1 rounded-full shrink-0 hidden sm:inline">
            模拟 · 200家
          </span>
        </header>

        <main
          className={cn(
            "flex-1 min-h-0",
            isChat || isNetwork
              ? "flex flex-col overflow-hidden p-0"
              : "overflow-auto p-4 sm:p-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/search" element={<EnterpriseSearch />} />
                  <Route path="/enterprise/:id" element={<EnterpriseDetail />} />
                  <Route path="/pk" element={<EnterprisePK />} />
                  <Route path="/warnings" element={<RiskWarnings />} />
                  <Route path="/network" element={<NetworkGraph />} />
                  <Route path="/chat" element={<ChatPanel />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
