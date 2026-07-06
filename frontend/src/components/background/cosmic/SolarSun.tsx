import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { planetParticleVertexShader, planetParticleFragmentShader } from "./shaders";
import { buildPlanetGeometry, hexToVec3, CORE_THEME } from "./planetGeometry";

interface CosmicCoreProps {
  intensity?: number;
  paused?: boolean;
  scale?: number;
}

/** Hub 中心星核 — 宇宙能量核心（轨道交互锚点，非真实太阳） */
export default function SolarSun({ intensity = 1, paused = false, scale = 1 }: CosmicCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => buildPlanetGeometry(CORE_THEME, "core"), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uIntensity: { value: intensity },
      uGlow: { value: 1.45 },
      uPointScale: { value: 1.0 },
      uTwinkle: { value: 0.65 },
      uMotion: { value: 1.0 },
      uPrimary: { value: hexToVec3(CORE_THEME.primary) },
      uSecondary: { value: hexToVec3(CORE_THEME.secondary) },
      uAccent: { value: hexToVec3(CORE_THEME.accent) },
    }),
    [intensity],
  );

  useFrame((state) => {
    if (!groupRef.current || !matRef.current || paused) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    matRef.current.uniforms.uGlow.value =
      1.35 + Math.sin(state.clock.elapsedTime * 1.2) * 0.15;
  });

  return (
    <group ref={groupRef} scale={scale} position={[0, 0, 2.5]}>
      <points geometry={geometry} renderOrder={4} frustumCulled={false}>
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
  );
}
