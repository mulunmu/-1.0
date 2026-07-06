import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  ribbonVertexShader,
  ribbonFragmentShader,
  microStarVertexShader,
  microStarFragmentShader,
} from "./shaders";
import SolarSun from "./SolarSun";
import SaturnParticles from "./SaturnParticles";
import MilkyWayBand from "./MilkyWayBand";
import { getSolarModuleById } from "@/lib/solarModules";
import { CORE_THEME } from "./planetGeometry";
import { textZoneToWorld, type TextZone } from "./types";

export interface CosmicFocus {
  x: number;
  y: number;
  strength: number;
}

interface CosmicSceneProps {
  intensity?: number;
  focus?: CosmicFocus;
  paused?: boolean;
  starCount?: number;
  showSaturn?: boolean;
  layout?: "login" | "hub" | "subtle";
  textZone?: TextZone | null;
  activeModuleId?: string;
}

function MistPlane({ intensity, paused }: { intensity: number; paused: boolean }) {
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
  }, [size.width, size.height, uniforms.uResolution]);

  useFrame((state) => {
    if (!matRef.current || paused) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={[0, 0, 0]} scale={[viewport.width * 1.52, viewport.height * 1.52, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={ribbonVertexShader}
        fragmentShader={ribbonFragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

function buildMicroStars(
  count: number,
  spread: [number, number, number],
  mode: "default" | "fine" = "default",
) {
  const positions = new Float32Array(count * 3);
  const phaseArr = new Float32Array(count);
  const sizeArr = new Float32Array(count);
  const goldArr = new Float32Array(count);
  const angleArr = new Float32Array(count);
  const streakArr = new Float32Array(count);
  const [sx, sy, sz] = spread;

  const diagLen = Math.hypot(1, -0.82);
  const dx = 1 / diagLen;
  const dy = -0.82 / diagLen;
  const px = dy;
  const py = -dx;

  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;

    if (mode === "fine" && Math.random() < 0.7) {
      const along = (Math.random() * 0.75 + 0.08) * sx * 0.55 - sx * 0.08;
      const across = ((Math.random() + Math.random()) / 2 - 0.5) * sy * 0.22;
      x = dx * along + px * across;
      y = dy * along + py * across;
    } else {
      x = (Math.random() - 0.5) * sx;
      y = (Math.random() - 0.5) * sy;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = -Math.random() * sz - 5;
    phaseArr[i] = Math.random() * Math.PI * 2;
    angleArr[i] = Math.random() * Math.PI * 2;

    if (mode === "fine") {
      streakArr[i] = 0;
      sizeArr[i] = 0.02 + Math.random() * 0.05;
      if (Math.random() < 0.06) sizeArr[i] *= 1.35;
      goldArr[i] = Math.random() < 0.03 ? 1 : 0;
    } else {
      const isStreak = Math.random() < 0.18;
      streakArr[i] = isStreak ? 1 : 0;

      if (isStreak) {
        sizeArr[i] = 0.12 + Math.random() * 0.2;
      } else if (Math.random() < 0.9) {
        sizeArr[i] = 0.06 + Math.random() * 0.14;
      } else {
        sizeArr[i] = 0.2 + Math.random() * 0.16;
      }
      goldArr[i] = Math.random() < 0.05 ? 1 : 0;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phaseArr, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizeArr, 1));
  geo.setAttribute("aGold", new THREE.BufferAttribute(goldArr, 1));
  geo.setAttribute("aAngle", new THREE.BufferAttribute(angleArr, 1));
  geo.setAttribute("aStreak", new THREE.BufferAttribute(streakArr, 1));
  return geo;
}

function StarField({
  intensity,
  paused,
  starCount = 280,
  spread,
  textZone,
  viewport,
  mode = "default",
}: {
  intensity: number;
  paused: boolean;
  starCount?: number;
  spread: [number, number, number];
  textZone?: TextZone | null;
  viewport: { width: number; height: number };
  mode?: "default" | "fine";
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(
    () => buildMicroStars(starCount, spread, mode),
    [starCount, spread[0], spread[1], spread[2], mode],
  );

  const excludeUniforms = useMemo(() => {
    if (!textZone) {
      return {
        uExcludeCenter: { value: new THREE.Vector2(999, 999) },
        uExcludeHalf: { value: new THREE.Vector2(1, 1) },
        uExcludeForce: { value: 0 },
      };
    }
    const world = textZoneToWorld(textZone, viewport);
    return {
      uExcludeCenter: { value: new THREE.Vector2(world.center[0], world.center[1]) },
      uExcludeHalf: { value: new THREE.Vector2(world.half[0], world.half[1]) },
      uExcludeForce: { value: world.force * 0.35 },
    };
  }, [textZone, viewport.width, viewport.height]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uIntensity: { value: intensity },
      uSizeMul: { value: mode === "fine" ? 0.32 : 1.0 },
      ...excludeUniforms,
    }),
    [intensity, excludeUniforms, mode],
  );

  useFrame((state) => {
    if (!matRef.current || paused) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} renderOrder={1}>
      <shaderMaterial
        ref={matRef}
        vertexShader={microStarVertexShader}
        fragmentShader={microStarFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface SolarSunLayoutConfig {
  scale: number;
  intensity: number;
}

function resolveSolarSunConfig(
  viewport: { width: number; height: number },
  intensity: number,
): SolarSunLayoutConfig {
  const minDim = Math.min(viewport.width, viewport.height);
    return {
      scale: minDim * 0.112,
      intensity: intensity * 1.05,
    };
}

function SceneContent({
  intensity = 1,
  paused = false,
  starCount = 280,
  showSaturn = true,
  layout = "hub",
  textZone = null,
  activeModuleId = "dashboard",
}: CosmicSceneProps) {
  const { viewport } = useThree();

  const starSpread = useMemo(
    (): [number, number, number] => [viewport.width * 1.2, viewport.height * 1.2, 12],
    [viewport.width, viewport.height],
  );

  const sunConfig = useMemo(() => {
    if (layout !== "hub") return null;
    return resolveSolarSunConfig(viewport, intensity);
  }, [layout, viewport.width, viewport.height, intensity]);

  const moduleCelestial = useMemo(() => {
    return getSolarModuleById(activeModuleId)?.celestial ?? CORE_THEME;
  }, [activeModuleId]);

  const subtleSaturn = useMemo(() => {
    if (layout !== "subtle" || !showSaturn) return null;
    const minDim = Math.min(viewport.width, viewport.height);
    return {
      scale: minDim * 0.118,
      intensity: intensity * 0.62,
      position: [-viewport.width * 0.30, -viewport.height * 0.30, 1.5] as [number, number, number],
      celestial: moduleCelestial,
    };
  }, [layout, showSaturn, viewport.width, viewport.height, intensity, moduleCelestial]);

  const mistIntensity =
    layout === "login" ? intensity * 0.28 : layout === "subtle" ? intensity * 0.75 : intensity * 0.72;

  return (
    <>
      {layout === "login" ? (
        <MilkyWayBand intensity={intensity} paused={paused} />
      ) : (
        <>
          <MistPlane intensity={mistIntensity} paused={paused} />
          <StarField
            intensity={intensity}
            paused={paused}
            starCount={starCount}
            spread={starSpread}
            textZone={textZone}
            viewport={viewport}
          />
        </>
      )}
      {layout === "hub" && sunConfig && (
        <SolarSun intensity={sunConfig.intensity} paused={paused} scale={sunConfig.scale} />
      )}
      {subtleSaturn && (
        <SaturnParticles
          intensity={subtleSaturn.intensity}
          paused={paused}
          scale={subtleSaturn.scale}
          position={subtleSaturn.position}
          tilt={0.52}
          mode="module"
          orthographic
          dotOnly
          textZone={textZone}
          viewport={viewport}
          celestial={subtleSaturn.celestial}
        />
      )}
    </>
  );
}

export default function CosmicScene(props: CosmicSceneProps) {
  return (
    <>
      <color attach="background" args={["#050508"]} />
      <SceneContent {...props} />
    </>
  );
}

export type { TextZone };
