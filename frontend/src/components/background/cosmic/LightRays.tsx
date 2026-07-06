import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lightRayVertexShader, lightRayFragmentShader } from "./shaders";

interface LightRaysProps {
  intensity?: number;
  count?: number;
  paused?: boolean;
  coreOnly?: boolean;
}

function buildLightRayGeometry(count: number, coreOnly = false) {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const angles = new Float32Array(count);
  const lens = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const dist = coreOnly
      ? 0.12 + Math.random() * 0.55
      : 0.35 + Math.random() * 2.8;
    positions[i * 3] = Math.cos(angle) * dist;
    positions[i * 3 + 1] = (Math.random() - 0.5) * (coreOnly ? 0.04 : 0.08);
    positions[i * 3 + 2] = Math.sin(angle) * dist;
    phases[i] = Math.random() * Math.PI * 2;
    angles[i] = angle;
    lens[i] = coreOnly ? 0.35 + Math.random() * 0.45 : 0.55 + Math.random() * 0.85;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
  geo.setAttribute("aLen", new THREE.BufferAttribute(lens, 1));
  return geo;
}

/** 径向粒子光束 — 从核心向外发散 */
export default function LightRays({
  intensity = 1,
  count = 140,
  paused = false,
  coreOnly = false,
}: LightRaysProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => buildLightRayGeometry(count, coreOnly), [count, coreOnly]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uIntensity: { value: intensity },
    }),
    [intensity],
  );

  useFrame((state) => {
    if (!matRef.current || paused) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} renderOrder={2}>
      <shaderMaterial
        ref={matRef}
        vertexShader={lightRayVertexShader}
        fragmentShader={lightRayFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
