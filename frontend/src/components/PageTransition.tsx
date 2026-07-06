import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { runPageEnter, MOTION_EASE, MOTION_ROUTE_MS } from "@/lib/motion";
import { useRouteTransitionOptional } from "@/lib/RouteTransitionContext";
import { cn } from "@/lib/utils";

/** 子路由切换 — 淡出旧页 / 淡入新页 + 区块错落 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const innerRef = useRef<HTMLDivElement>(null);
  const routeTransition = useRouteTransitionOptional();
  const isExiting = routeTransition?.phase === "out";

  useEffect(() => {
    runPageEnter(innerRef.current);
  }, [pathname]);

  return (
    <div
      className={cn(
        "flex flex-1 min-h-0 h-full w-full flex-col",
        "transition-[opacity,transform] will-change-[opacity,transform]",
        isExiting && "pointer-events-none opacity-0 translate-y-1.5",
      )}
      style={{
        transitionDuration: `${MOTION_ROUTE_MS}ms`,
        transitionTimingFunction: MOTION_EASE,
      }}
    >
      <div
        key={pathname}
        ref={innerRef}
        className="flex flex-1 min-h-0 h-full w-full flex-col"
      >
        {children}
      </div>
    </div>
  );
}
