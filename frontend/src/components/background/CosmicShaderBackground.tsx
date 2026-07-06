import { Suspense, useEffect, useState, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import CosmicScene, { type CosmicFocus, type TextZone } from "./cosmic/CosmicScene";
import { MOTION_EASE, MOTION_ROUTE_MS } from "@/lib/motion";

export type { CosmicFocus, TextZone };

export interface CosmicShaderBackgroundProps {
  variant?: "hub" | "login" | "subtle";
  focus?: CosmicFocus;
  paused?: boolean;
  className?: string;
  fixed?: boolean;
  textZone?: TextZone | null;
  /** 当前业务模块 — 驱动背景星环配色 */
  activeModuleId?: string;
}

const INTENSITY: Record<NonNullable<CosmicShaderBackgroundProps["variant"]>, number> = {
  hub: 0.9,
  login: 0.95,
  subtle: 0.78,
};

const STAR_COUNT: Record<NonNullable<CosmicShaderBackgroundProps["variant"]>, number> = {
  hub: 480,
  login: 3600,
  subtle: 300,
};

const OPACITY: Record<NonNullable<CosmicShaderBackgroundProps["variant"]>, number> = {
  hub: 0.94,
  login: 1,
  subtle: 0.55,
};

/** 各页面标题占用区 — 粒子在此区域被排斥让位 */
const TEXT_ZONE: Record<NonNullable<CosmicShaderBackgroundProps["variant"]>, TextZone | null> = {
  login: null,
  hub: null,
  subtle: null,
};

const FIXED_BG_STYLE: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: "100%",
  height: "100%",
  minHeight: "100dvh",
  zIndex: 0,
  pointerEvents: "none",
  overflow: "hidden",
  background: "#050508",
};

export default function CosmicShaderBackground({
  variant = "hub",
  focus: _focus = { x: 0.5, y: 0.5, strength: 0.12 },
  paused = false,
  className,
  fixed = false,
  textZone,
  activeModuleId = "dashboard",
}: CosmicShaderBackgroundProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [moduleBlend, setModuleBlend] = useState(1);
  const zone = textZone !== undefined ? textZone : TEXT_ZONE[variant];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (variant !== "subtle" || reduceMotion) return;
    setModuleBlend(0.88);
    const timer = window.setTimeout(() => setModuleBlend(1), MOTION_ROUTE_MS);
    return () => window.clearTimeout(timer);
  }, [activeModuleId, variant, reduceMotion]);

  if (reduceMotion) {
    return (
      <div
        className={className}
        aria-hidden
        style={fixed ? FIXED_BG_STYLE : { position: "absolute", inset: 0, zIndex: 0, background: "#050508" }}
      />
    );
  }

  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5);

  const wrapperStyle: CSSProperties = fixed
    ? {
        ...FIXED_BG_STYLE,
        opacity: OPACITY[variant],
        transition: `opacity ${MOTION_ROUTE_MS}ms ${MOTION_EASE}`,
      }
    : {
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "#050508",
        opacity: OPACITY[variant] * moduleBlend,
        transition: `opacity ${MOTION_ROUTE_MS}ms ${MOTION_EASE}`,
      };

  return (
    <div className={className} aria-hidden style={wrapperStyle}>
      <Canvas
        dpr={dpr}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
        }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
      >
        <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={72} near={-50} far={100} />
        <Suspense fallback={null}>
          <CosmicScene
            intensity={INTENSITY[variant]}
            paused={paused}
            starCount={STAR_COUNT[variant]}
            showSaturn={false}
            layout={variant}
            textZone={zone}
            activeModuleId={activeModuleId}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
