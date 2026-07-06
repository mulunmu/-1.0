import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";
import { MOTION_ROUTE_MS, prefersReducedMotion } from "@/lib/motion";

export type RouteTransitionPhase = "idle" | "out";

interface RouteTransitionContextValue {
  phase: RouteTransitionPhase;
  navigateSmooth: (to: string, options?: NavigateOptions) => void;
}

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null);

export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<RouteTransitionPhase>("idle");
  const timerRef = useRef<number | null>(null);

  const navigateSmooth = useCallback(
    (to: string, options?: NavigateOptions) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);

      if (prefersReducedMotion()) {
        navigate(to, options);
        return;
      }

      setPhase("out");
      timerRef.current = window.setTimeout(() => {
        navigate(to, options);
        setPhase("idle");
        timerRef.current = null;
      }, MOTION_ROUTE_MS);
    },
    [navigate],
  );

  const value = useMemo(
    () => ({ phase, navigateSmooth }),
    [phase, navigateSmooth],
  );

  return (
    <RouteTransitionContext.Provider value={value}>
      {children}
    </RouteTransitionContext.Provider>
  );
}

export function useRouteTransition() {
  const ctx = useContext(RouteTransitionContext);
  if (!ctx) {
    throw new Error("useRouteTransition must be used within RouteTransitionProvider");
  }
  return ctx;
}

export function useRouteTransitionOptional() {
  return useContext(RouteTransitionContext);
}
