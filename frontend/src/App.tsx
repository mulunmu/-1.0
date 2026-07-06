import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { useMemo, useEffect } from "react";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Hub from "@/pages/Hub";
import Dashboard from "@/pages/Dashboard";
import EnterpriseDetail from "@/pages/EnterpriseDetail";
import EnterpriseSearch from "@/pages/EnterpriseSearch";
import ChatPanel from "@/pages/ChatPanel";
import NetworkGraph from "@/pages/NetworkGraph";
import Reports from "@/pages/Reports";
import { PKRedirect, SearchRedirect, WarningsRedirect } from "@/components/legacy/LegacyRedirects";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getToken } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import MockDataBanner from "@/components/MockDataBanner";
import PageTransition from "@/components/PageTransition";
import CosmicShaderBackground from "@/components/background/CosmicShaderBackground";
import SolarNav from "@/components/nav/SolarNav";
import { resolveSolarModuleId } from "@/lib/solarModules";
import { resolveDataMode } from "@/lib/dataSource";
import { RouteTransitionProvider } from "@/lib/RouteTransitionContext";
import { cn } from "@/lib/utils";

/** 业务页通用布局：宇宙背景 + 底部轨道导航 */
function Layout() {
  const location = useLocation();

  const activeId = useMemo(() => resolveSolarModuleId(location.pathname), [location.pathname]);

  const isImmersive = useMemo(() => {
    const path = location.pathname;
    return path.startsWith(ROUTES.chat) || path.startsWith(ROUTES.network);
  }, [location.pathname]);

  useEffect(() => {
    resolveDataMode().catch(() => undefined);
  }, []);

  return (
    <RouteTransitionProvider>
      <div className="relative isolate flex h-screen flex-col overflow-hidden bg-transparent">
        <CosmicShaderBackground variant="subtle" activeModuleId={activeId} />
        <div className="absolute inset-0 z-[1] pointer-events-none cosmic-edge-vignette opacity-40" />

        <MockDataBanner />

        <main
          className={cn(
            "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden",
            "transition-[padding] duration-300 ease-out",
            isImmersive
              ? "px-3 py-2 sm:px-4 sm:py-3"
              : "px-4 py-3 sm:px-5 sm:py-4",
          )}
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        <SolarNav mode="mini" activeId={activeId} className="relative z-10 shrink-0" />
      </div>
    </RouteTransitionProvider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to={ROUTES.login} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.login} element={<Login />} />
          <Route path={ROUTES.register} element={<Register />} />

          <Route
            path={ROUTES.hub}
            element={
              <ProtectedRoute>
                <Hub />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="enterprises" element={<EnterpriseSearch />} />
            <Route path="search" element={<SearchRedirect />} />
            <Route path="pk" element={<PKRedirect />} />
            <Route path="warnings" element={<WarningsRedirect />} />
            <Route path="enterprise/:id" element={<EnterpriseDetail />} />
            <Route path="network" element={<NetworkGraph />} />
            <Route path="chat" element={<ChatPanel />} />
            <Route path="reports" element={<Reports />} />
            <Route index element={<Navigate to={ROUTES.hub} replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
