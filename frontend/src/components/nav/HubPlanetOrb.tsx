import { memo, Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { planetParticleVertexShader, planetParticleFragmentShader } from "@/components/background/cosmic/shaders";
import { buildPlanetGeometry, hexToVec3, type CelestialCluster } from "@/components/background/cosmic/planetGeometry";

/** 静态帧 — 公转期间不做 shader 动画，避免 Canvas 随 DOM 移动时闪烁/抖动 */
function HubPlanetStaticMesh({
  theme,
  seedRotation,
  active,
}: {
  theme: CelestialCluster;
  seedRotation: number;
  active: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => buildPlanetGeometry(theme, "nav"), [theme]);
  const invalidate = useThree((s) => s.invalidate);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uIntensity: { value: active ? 1.35 : 1.05 },
      uGlow: { value: active ? 1.0 : 0.48 },
      uPointScale: { value: 1.0 },
      uTwinkle: { value: 0 },
      uMotion: { value: 0 },
      uPrimary: { value: hexToVec3(theme.primary) },
      uSecondary: { value: hexToVec3(theme.secondary) },
      uAccent: { value: hexToVec3(theme.accent) },
    }),
    [theme, active],
  );

  useLayoutEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = seedRotation;
      groupRef.current.rotation.x = 0.14;
    }
    invalidate();
  }, [theme, seedRotation, active, invalidate]);

  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          vertexShader={planetParticleVertexShader}
          fragmentShader={planetParticleFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export interface HubPlanetOrbProps {
  theme: CelestialCluster;
  size?: number;
  active?: boolean;
  seedRotation?: number;
  className?: string;
}

function HubPlanetOrb({
  theme,
  size = 108,
  active = false,
  seedRotation = 0,
  className,
}: HubPlanetOrbProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        pointerEvents: "none",
        contain: "strict",
      }}
      aria-hidden
    >
      <Canvas
        dpr={1}
        frameloop="demand"
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
        }}
        style={{ width: "100%", height: "100%", display: "block", background: "transparent" }}
      >
        <OrthographicCamera makeDefault position={[0, 0, 5]} zoom={95} near={0.1} far={20} />
        <Suspense fallback={null}>
          <HubPlanetStaticMesh theme={theme} seedRotation={seedRotation} active={active} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default memo(HubPlanetOrb);
