import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { milkyWayVertexShader, milkyWayFragmentShader } from "./shaders";

interface MilkyWayBandProps {
  intensity?: number;
  paused?: boolean;
}

/** 对角银河光带 — 全屏 nebula shader，含深空底色 */
export default function MilkyWayBand({ intensity = 1, paused = false }: MilkyWayBandProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uIntensity: { value: intensity },
    }),
    [intensity],
  );

  useEffect(() => {
    uniforms.uResolution.value.set(size.width, size.height);
    uniforms.uIntensity.value = intensity;
  }, [size.width, size.height, intensity, uniforms.uResolution, uniforms.uIntensity]);

  useFrame((state) => {
    if (!matRef.current || paused) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={[0, 0, -0.5]} scale={[viewport.width * 1.55, viewport.height * 1.55, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={milkyWayVertexShader}
        fragmentShader={milkyWayFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}
