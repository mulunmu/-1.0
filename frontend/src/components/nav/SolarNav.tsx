import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouteTransitionOptional } from "@/lib/RouteTransitionContext";
import HubPlanetOrb from "@/components/nav/HubPlanetOrb";
import MiniNavOrb, { NAV_CORE_THEME } from "@/components/nav/MiniNavOrb";
import { ROUTES } from "@/lib/routes";
import { removeToken } from "@/lib/auth";
import { SOLAR_MODULES, resolveSolarModuleId, type SolarModule } from "@/lib/solarModules";
import type { CosmicFocus } from "@/components/background/CosmicShaderBackground";

export type { CosmicFocus };

export interface SolarNavProps {
  mode: "hub" | "mini";
  activeId?: string;
  className?: string;
  onFocusChange?: (focus: CosmicFocus) => void;
  onExitStart?: () => void;
}

/** Hub 统一公转 — 72s 周期，72° 固定相位差（CSS 动画驱动，避免 remount 后 RAF 抖动） */
const HUB_ORBIT_PERIOD = 72;

function hubModuleAngle(index: number, time: number): number {
  const base = (index / SOLAR_MODULES.length) * Math.PI * 2 - Math.PI / 2;
  return base + (time / HUB_ORBIT_PERIOD) * Math.PI * 2;
}

function hubModulePhaseDeg(index: number): number {
  return (index / SOLAR_MODULES.length) * 360 - 90;
}

/** 从 CSS 轨道动画读取当前相位（秒），供悬停/退出冻结 focus 用 */
function readOrbitAnimTime(el: HTMLElement | null): number {
  if (!el) return 0;
  const anim = el.getAnimations()[0];
  if (!anim || anim.currentTime == null) return 0;
  const ms = typeof anim.currentTime === "number" ? anim.currentTime : 0;
  return (ms / 1000) % HUB_ORBIT_PERIOD;
}

function focusFromAngle(angle: number, radius: number, containerSize: number, strength: number): CosmicFocus {
  const cx = Math.cos(angle) * radius;
  const cy = Math.sin(angle) * radius;
  return {
    x: 0.5 + cx / containerSize,
    y: 0.5 - cy / containerSize,
    strength,
  };
}

const HUB_LABEL_HALF_H = 32;
const HUB_VIEWPORT_PAD_X = 48;
const HUB_FOOTER_HEIGHT = 128;

interface HubOrbitLayout {
  containerSize: number;
  boundsHalf: number;
  coreClear: number;
  planetSize: number;
  planetSizeHover: number;
  orbitRadii: number[];
}

function computeHubOrbitLayout(): HubOrbitLayout {
  const orbitAreaH = window.innerHeight - HUB_FOOTER_HEIGHT - 32;
  const orbitAreaW = window.innerWidth - HUB_VIEWPORT_PAD_X * 2;
  const boundsHalf = Math.floor(Math.min(orbitAreaW, orbitAreaH) / 2);
  const containerSize = boundsHalf * 2;

  const planetSize = Math.round(Math.min(156, Math.max(128, boundsHalf * 0.2)));
  const planetSizeHover = planetSize + 18;
  const planetReach = (planetSizeHover * 1.1) / 2;
  const labelReach = HUB_LABEL_HALF_H + 28;
  const edgeMargin = 28;

  const maxOrbitRadius = boundsHalf - planetReach - labelReach - edgeMargin;
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  const coreClear = Math.round(minDim * 0.118 + 32);
  const innerOrbit = Math.max(coreClear + planetReach * 0.8 + 24, maxOrbitRadius * 0.44);
  const orbitStep = (maxOrbitRadius - innerOrbit) / (SOLAR_MODULES.length - 1);

  const orbitRadii = SOLAR_MODULES.map((_, i) =>
    innerOrbit + orbitStep * i,
  );

  return {
    containerSize,
    boundsHalf,
    coreClear,
    planetSize,
    planetSizeHover,
    orbitRadii,
  };
}

function useHubOrbitLayout(): HubOrbitLayout {
  const [layout, setLayout] = useState<HubOrbitLayout>(() => computeHubOrbitLayout());

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setLayout(computeHubOrbitLayout()));
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, []);

  return layout;
}

function HubPlanetNode({
  module,
  index,
  orbitRadius,
  planetSize,
  planetSizeHover,
  hoveredId,
  exitingId,
  pressingId,
  dimOthers,
  onHoverStart,
  onHoverEnd,
  onActivate,
}: {
  module: SolarModule;
  index: number;
  orbitRadius: number;
  planetSize: number;
  planetSizeHover: number;
  hoveredId: string | null;
  exitingId: string | null;
  pressingId: string | null;
  dimOthers: boolean;
  onHoverStart: (id: string, orbitTime: number) => void;
  onHoverEnd: (id: string) => void;
  onActivate: (id: string, orbitTime: number) => void;
}) {
  const armRef = useRef<HTMLDivElement>(null);

  const isHovered = hoveredId === module.id;
  const isExiting = exitingId === module.id;
  const isPressed = pressingId === module.id;
  const isDimmed = dimOthers && hoveredId !== null && !isHovered;
  const scale = isExiting ? 2 : isPressed ? 1.05 : isHovered ? 1.1 : isDimmed ? 0.9 : 1;
  const opacity = isExiting ? 0 : isDimmed ? 0.22 : isHovered ? 1 : 0.82;
  const orbitFrozen = isHovered || exitingId !== null;

  const armStyle = {
    ["--hub-r" as string]: `${orbitRadius}px`,
    ["--hub-phase" as string]: `${hubModulePhaseDeg(index)}deg`,
    animationPlayState: orbitFrozen ? "paused" : "running",
  } as React.CSSProperties;

  return (
    <div ref={armRef} className={cn("hub-orbit-item", isHovered && "z-20", isExiting && "z-30")} style={armStyle}>
      <div
        className="hub-orbit-body"
        style={{
          width: planetSizeHover,
          height: planetSizeHover,
          transform: `translate(-50%, -50%) scale(${scale})`,
          opacity,
          transition: isExiting || isHovered || isDimmed
            ? "opacity 280ms ease-out, transform 280ms ease-out"
            : "none",
        }}
      >
        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center"
          onMouseEnter={() => onHoverStart(module.id, readOrbitAnimTime(armRef.current))}
          onMouseLeave={() => onHoverEnd(module.id)}
          onFocus={() => onHoverStart(module.id, readOrbitAnimTime(armRef.current))}
          onBlur={() => onHoverEnd(module.id)}
          onClick={() => onActivate(module.id, readOrbitAnimTime(armRef.current))}
          disabled={exitingId !== null}
          aria-label={`${module.orbitTag} ${module.label}`}
        >
          <div
            style={{
              transform: isHovered ? "none" : `scale(${planetSize / planetSizeHover})`,
              transition: "transform 280ms ease-out",
            }}
          >
            <HubPlanetOrb
              theme={module.celestial}
              size={planetSizeHover}
              active={isHovered}
              seedRotation={index * 1.047}
            />
          </div>
        </button>

        <div className="absolute left-1/2 top-full mt-4 -translate-x-1/2 pointer-events-none select-none whitespace-nowrap text-center">
          <span
            className="text-sm font-medium tracking-wide"
            style={{
              color: isHovered ? module.color : "rgba(212,212,216,0.88)",
              textShadow: isHovered
                ? `0 0 14px ${module.color}55, 0 0 2px rgba(0,0,0,0.9)`
                : "0 0 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)",
              transition: "color 280ms ease-out",
            }}
          >
            <span className="block text-[10px] opacity-55 mb-0.5 tracking-widest">{module.orbitTag}</span>
            {module.label}
          </span>
        </div>
      </div>
    </div>
  );
}

const MINI_ORB_SIZE = 62;
const MINI_ORB_ACTIVE = 72;
const MINI_CORE_SIZE = 66;

function MiniPlanet({
  module,
  isActive,
  onClick,
}: {
  module: SolarModule;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={module.label}
      className={cn(
        "flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl",
        "transition-all duration-[240ms] ease-out",
        isActive ? "opacity-100 scale-105" : "opacity-60 hover:opacity-80 hover:scale-105",
      )}
      onClick={onClick}
    >
      <MiniNavOrb
        theme={module.celestial}
        size={isActive ? MINI_ORB_ACTIVE : MINI_ORB_SIZE}
        active={isActive}
        paused={!isActive}
      />
      <span
        className="text-[10px] font-medium tracking-wide"
        style={{ color: isActive ? module.color : "rgba(163,163,163,0.85)" }}
      >
        {module.shortLabel}
      </span>
    </button>
  );
}

/** Hub 透镜轨道区 — 独立组件，CSS 公转仅在此挂载 */
function HubOrbitNav({
  onFocusChange,
  onExitStart,
}: {
  onFocusChange?: (focus: CosmicFocus) => void;
  onExitStart?: () => void;
}) {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [frozenTimes, setFrozenTimes] = useState<Record<string, number>>({});
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [pressingId, setPressingId] = useState<string | null>(null);

  const hubLayout = useHubOrbitLayout();

  const hoveredModule = SOLAR_MODULES.find((m) => m.id === hoveredId);
  const hoveredIndex = hoveredModule ? SOLAR_MODULES.indexOf(hoveredModule) : -1;

  const handleHoverStart = useCallback((id: string, orbitTime: number) => {
    setFrozenTimes((prev) => ({ ...prev, [id]: orbitTime }));
    setHoveredId(id);
  }, []);

  const handleHoverEnd = useCallback((id: string) => {
    setFrozenTimes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setHoveredId((current) => (current === id ? null : current));
  }, []);

  const focus = useMemo((): CosmicFocus => {
    if (hoveredModule && hoveredIndex >= 0) {
      const t = frozenTimes[hoveredModule.id] ?? 0;
      const angle = hubModuleAngle(hoveredIndex, t);
      const radius = hubLayout.orbitRadii[hoveredIndex];
      return focusFromAngle(angle, radius, hubLayout.containerSize, 0.85);
    }
    if (exitingId) {
      const mod = SOLAR_MODULES.find((m) => m.id === exitingId);
      const idx = mod ? SOLAR_MODULES.indexOf(mod) : -1;
      if (mod && idx >= 0) {
        const t = frozenTimes[exitingId] ?? 0;
        const angle = hubModuleAngle(idx, t);
        const radius = hubLayout.orbitRadii[idx];
        return focusFromAngle(angle, radius, hubLayout.containerSize, 1);
      }
    }
    return { x: 0.5, y: 0.5, strength: 0.18 };
  }, [hoveredModule, hoveredIndex, exitingId, frozenTimes, hubLayout]);

  useEffect(() => {
    onFocusChange?.(focus);
  }, [focus, onFocusChange]);

  const handleActivate = useCallback(
    (moduleId: string, orbitTime: number) => {
      setFrozenTimes((prev) => ({ ...prev, [moduleId]: prev[moduleId] ?? orbitTime }));
      setPressingId(moduleId);
      onExitStart?.();
      setTimeout(() => {
        setPressingId(null);
        setExitingId(moduleId);
        const mod = SOLAR_MODULES.find((m) => m.id === moduleId);
        if (mod) {
          setTimeout(() => navigate(mod.path), 320);
        }
      }, 120);
    },
    [navigate, onExitStart],
  );

  const handleLogout = useCallback(() => {
    removeToken();
    navigate(ROUTES.login);
  }, [navigate]);

  return (
    <div className="relative w-full min-h-screen">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="hub-orbit-field relative shrink-0 pointer-events-auto"
            style={{
              width: hubLayout.containerSize,
              height: hubLayout.containerSize,
            }}
          >
          {SOLAR_MODULES.map((module, i) => (
            <HubPlanetNode
              key={module.id}
              module={module}
              index={i}
              orbitRadius={hubLayout.orbitRadii[i]}
              planetSize={hubLayout.planetSize}
              planetSizeHover={hubLayout.planetSizeHover}
              hoveredId={hoveredId}
              exitingId={exitingId}
              pressingId={pressingId}
              dimOthers={hoveredId !== null}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              onActivate={handleActivate}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center pb-8 pt-2 pointer-events-auto">
        <p className="text-[10px] text-neutral-600 tracking-wider">
          {hoveredModule
            ? `点击进入 · ${hoveredModule.label}`
            : "悬停停轨高亮 · 沿宇宙轨道选择监测扇区"}
        </p>

        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "mt-4 flex items-center gap-2 px-4 py-2 rounded-lg",
            "text-xs text-neutral-500 hover:text-neutral-200",
            "border border-[var(--border-subtle)] hover:border-[var(--border-default)]",
            "bg-[var(--color-bg-surface)]/40 hover:bg-[var(--color-bg-surface)]/70",
            "transition-all duration-200 ease-out",
          )}
        >
          <LogOut size={13} />
          退出登录
        </button>
      </div>
    </div>
  );
}

export default function SolarNav({
  mode,
  activeId,
  className,
  onFocusChange,
  onExitStart,
}: SolarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const resolvedActiveId = useMemo(() => {
    if (activeId) return activeId;
    return resolveSolarModuleId(location.pathname);
  }, [activeId, location.pathname]);

  const routeTransition = useRouteTransitionOptional();

  const navigateSmooth = useCallback(
    (path: string) => {
      if (location.pathname === path) return;
      if (routeTransition) {
        routeTransition.navigateSmooth(path);
        return;
      }
      navigate(path);
    },
    [location.pathname, navigate, routeTransition],
  );

  if (mode === "hub") {
    return (
      <HubOrbitNav
        onFocusChange={onFocusChange}
        onExitStart={onExitStart}
      />
    );
  }

  return (
    <nav
      className={cn(
        "flex items-end justify-center gap-1 px-4 py-2 min-h-[104px]",
        "bg-[var(--color-bg-deep)]/92 backdrop-blur-md border-t border-[var(--border-subtle)]",
        className,
      )}
      aria-label="监测轨道导航"
    >
      <button
        type="button"
        title="返回透镜中心"
        className="flex flex-col items-center gap-1 px-2.5 py-1.5 mr-1 rounded-xl transition-all duration-[240ms] ease-out hover:scale-105 active:scale-95"
        onClick={() => navigateSmooth(ROUTES.hub)}
      >
        <MiniNavOrb
          theme={NAV_CORE_THEME}
          size={MINI_CORE_SIZE}
          active={false}
          paused
          geometryMode="core"
        />
        <span className="text-[10px] text-amber-200/70 font-medium">透镜</span>
      </button>

      <div className="w-px h-12 bg-white/8 mx-1 self-center" />

      {SOLAR_MODULES.map((module) => (
        <MiniPlanet
          key={module.id}
          module={module}
          isActive={resolvedActiveId === module.id}
          onClick={() => navigateSmooth(module.path)}
        />
      ))}
    </nav>
  );
}
