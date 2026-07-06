import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { planetParticleVertexShader, planetParticleFragmentShader } from "@/components/background/cosmic/shaders";
import { buildPlanetGeometry, hexToVec3, type CelestialCluster } from "@/components/background/cosmic/planetGeometry";

/** 底部导航「透镜」按钮专用主题（与 Hub 星核视觉接近，密度适配迷你栏） */
export const NAV_CORE_THEME: CelestialCluster = {
  primary: "#eef4ff",
  secondary: "#7eb8ff",
  accent: "#b8a8ff",
  coreCount: 180,
  coreRadius: 0.62,
};

const NAV_DISPLAY_RADIUS = 0.46;

function NavSphereCamera({ radius }: { radius: number }) {
  const { size, camera } = useThree();

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const pad = 1.16;
    const halfH = radius * pad;
    const halfW = halfH * (size.width / Math.max(size.height, 1));
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.near = 0.1;
    camera.far = 20;
    camera.position.set(0, 0, 4);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
  }, [camera, radius, size.width, size.height]);

  return null;
}

interface MiniNavMeshProps {
  theme: CelestialCluster;
  active?: boolean;
  paused?: boolean;
  geometryMode?: "mini" | "core";
  rotateSpeed?: number;
}

function MiniNavMesh({
  theme,
  active = false,
  paused = false,
  geometryMode = "mini",
  rotateSpeed = 0.08,
}: MiniNavMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const frozenRot = useRef(0);

  const displayTheme = useMemo((): CelestialCluster => {
    if (geometryMode === "core") {
      return { ...theme, coreCount: Math.min(theme.coreCount, 200) };
    }
    return {
      ...theme,
      coreCount: Math.min(Math.round(theme.coreCount * 0.52), 150),
    };
  }, [theme, geometryMode]);

  const geometry = useMemo(
    () => buildPlanetGeometry(displayTheme, geometryMode === "core" ? "core" : "mini"),
    [displayTheme, geometryMode],
  );
  const invalidate = useThree((s) => s.invalidate);

  const meshScale = NAV_DISPLAY_RADIUS / theme.coreRadius;
  const pointScale = geometryMode === "mini" ? 1.05 : 1.1;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uIntensity: { value: active ? 0.88 : 0.58 },
      uGlow: { value: active ? 0.62 : 0.32 },
      uPointScale: { value: pointScale },
      uTwinkle: { value: 0.85 },
      uMotion: { value: 1.0 },
      uPrimary: { value: hexToVec3(theme.primary) },
      uSecondary: { value: hexToVec3(theme.secondary) },
      uAccent: { value: hexToVec3(theme.accent) },
    }),
    [theme, active, pointScale],
  );

  useEffect(() => {
    if (paused) invalidate();
  }, [paused, active, theme, invalidate]);

  useFrame((state) => {
    if (!groupRef.current || !matRef.current) return;

    matRef.current.uniforms.uIntensity.value = active ? 0.88 : 0.58;
    matRef.current.uniforms.uGlow.value = active ? 0.62 : 0.32;

    if (paused) {
      groupRef.current.rotation.y = frozenRot.current;
      groupRef.current.rotation.x = 0;
      return;
    }

    frozenRot.current = state.clock.elapsedTime * rotateSpeed;
    groupRef.current.rotation.y = frozenRot.current;
    groupRef.current.rotation.x = 0;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <>
      <NavSphereCamera radius={NAV_DISPLAY_RADIUS} />
      <group ref={groupRef} scale={meshScale}>
        <points geometry={geometry} frustumCulled={false}>
          <shaderMaterial
            ref={matRef}
            vertexShader={planetParticleVertexShader}
            fragmentShader={planetParticleFragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </>
  );
}

export interface MiniNavOrbProps {
  theme: CelestialCluster;
  size?: number;
  active?: boolean;
  paused?: boolean;
  geometryMode?: "mini" | "core";
  rotateSpeed?: number;
  className?: string;
}

/** 业务页底部导航专用球体 — 与 Hub 透镜页独立调参 */
export default function MiniNavOrb({
  theme,
  size = 64,
  active = false,
  paused,
  geometryMode = "mini",
  rotateSpeed = 0.08,
  className,
}: MiniNavOrbProps) {
  const isPaused = paused ?? !active;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        aspectRatio: "1 / 1",
        pointerEvents: "none",
        opacity: active ? 0.95 : 0.62,
        filter: active
          ? `drop-shadow(0 0 6px ${theme.accent}55) drop-shadow(0 0 2px ${theme.primary}44)`
          : `drop-shadow(0 0 3px ${theme.primary}28)`,
        transition: "opacity 220ms ease-out, filter 220ms ease-out",
      }}
      aria-hidden
    >
      <Canvas
        dpr={Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2)}
        frameloop={isPaused ? "demand" : "always"}
        orthographic
        camera={{ position: [0, 0, 4], near: 0.1, far: 20, zoom: 1 }}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%", display: "block", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <MiniNavMesh
            theme={theme}
            active={active}
            paused={isPaused}
            geometryMode={geometryMode}
            rotateSpeed={rotateSpeed}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
