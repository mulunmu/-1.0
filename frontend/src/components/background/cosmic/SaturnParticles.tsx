import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { saturnMicroVertexShader, saturnMicroFragmentShader } from "./shaders";
import { textZoneToWorld, type TextZone } from "./types";
import { hexToVec3, CORE_THEME, type CelestialCluster } from "./planetGeometry";
import LightRays from "./LightRays";

export type SaturnMode = "full" | "hero" | "module" | "mini" | "card";

interface SaturnParticlesProps {
  intensity?: number;
  paused?: boolean;
  scale?: number;
  position?: [number, number, number];
  tilt?: number;
  mode?: SaturnMode;
  orthographic?: boolean;
  textZone?: TextZone | null;
  viewport?: { width: number; height: number };
  celestial?: CelestialCluster;
  /** 纯圆点渲染 — 球核 + 环带均为微小密集粒子，无拉丝光效 */
  dotOnly?: boolean;
}

const MODE_COUNTS: Record<SaturnMode, [number, number, number]> = {
  full: [6200, 18000, 7500],
  hero: [520, 3200, 480],
  module: [920, 9800, 0],
  mini: [120, 680, 0],
  card: [200, 2800, 0],
};

const RING_BANDS = [
  { r0: 1.38, r1: 1.62, y: 0.018, layer: 1, weight: 0.32 },
  { r0: 1.66, r1: 1.96, y: 0.016, layer: 1, weight: 0.28 },
  { r0: 1.98, r1: 2.38, y: 0.020, layer: 1, weight: 0.24 },
  { r0: 2.42, r1: 2.88, y: 0.018, layer: 2, weight: 0.16 },
] as const;

const RAY_COUNT: Record<SaturnMode, number> = {
  full: 180,
  hero: 130,
  module: 0,
  mini: 0,
  card: 0,
};

const ROTATION_SPEED: Record<SaturnMode, number> = {
  full: 0.06,
  hero: 0.022,
  module: 0.012,
  mini: 0.014,
  card: 0.011,
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickRingBand() {
  const total = RING_BANDS.reduce((s, b) => s + b.weight, 0);
  let t = Math.random() * total;
  for (const band of RING_BANDS) {
    t -= band.weight;
    if (t <= 0) return band;
  }
  return RING_BANDS[RING_BANDS.length - 1];
}

function ringRadiusInBand(r0: number, r1: number) {
  return Math.sqrt(rand(r0 * r0, r1 * r1));
}

function buildStructuredSaturnGeometry(mode: SaturnMode) {
  const [coreCount, ringCount] = MODE_COUNTS[mode];
  const total = coreCount + ringCount;
  const isCompact = mode === "mini" || mode === "card";

  const positions = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const layers = new Float32Array(total);
  const golds = new Float32Array(total);
  const angles = new Float32Array(total);
  const streakLens = new Float32Array(total);

  let idx = 0;

  const coreMax = mode === "card" ? 0.56 : isCompact ? 0.62 : 0.68;
  const coreMin = mode === "card" ? 0.24 : isCompact ? 0.26 : 0.22;

  for (let i = 0; i < coreCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = rand(coreMin, coreMax);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta) * 0.94;
    const z = r * Math.cos(phi);
    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;
    sizes[idx] = rand(0.06, 0.13);
    phases[idx] = Math.random() * Math.PI * 2;
    layers[idx] = 0;
    golds[idx] = Math.random() < 0.18 ? 1 : 0;
    angles[idx] = Math.atan2(y, x);
    streakLens[idx] = 1.0;
    idx++;
  }

  for (let i = 0; i < ringCount; i++) {
    const band = pickRingBand();
    const angle = Math.random() * Math.PI * 2;
    const radius = ringRadiusInBand(band.r0, band.r1);
    const y = (Math.random() - 0.5) * band.y;
    positions[idx * 3] = Math.cos(angle) * radius;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = Math.sin(angle) * radius;
    sizes[idx] = rand(0.045, 0.11);
    phases[idx] = Math.random() * Math.PI * 2;
    layers[idx] = band.layer;
    golds[idx] = Math.random() < 0.08 ? 1 : 0;
    angles[idx] = angle;
    streakLens[idx] = 1.0;
    idx++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aLayer", new THREE.BufferAttribute(layers, 1));
  geo.setAttribute("aGold", new THREE.BufferAttribute(golds, 1));
  geo.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
  geo.setAttribute("aStreakLen", new THREE.BufferAttribute(streakLens, 1));
  return geo;
}

function buildLegacySaturnGeometry(mode: SaturnMode) {
  const [coreCount, ringCount, outerCount] = MODE_COUNTS[mode];
  const isFull = mode === "full";
  const total = coreCount + ringCount + outerCount;

  const positions = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const layers = new Float32Array(total);
  const golds = new Float32Array(total);
  const angles = new Float32Array(total);
  const streakLens = new Float32Array(total);

  let idx = 0;

  for (let i = 0; i < coreCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = rand(isFull ? 0.28 : 0.35, isFull ? 0.72 : 0.88);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta) * (isFull ? 0.92 : 1.0);
    const z = r * Math.cos(phi);
    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;
    sizes[idx] = isFull ? rand(0.22, 0.62) : rand(0.2, 0.55);
    phases[idx] = Math.random() * Math.PI * 2;
    layers[idx] = 0;
    golds[idx] = Math.random() < 0.22 ? 1 : 0;
    angles[idx] = Math.atan2(y, x);
    streakLens[idx] = rand(0.55, 0.85);
    idx++;
  }

  for (let i = 0; i < ringCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    let radius = rand(isFull ? 1.38 : 1.55, isFull ? 3.55 : 3.2);
    if (isFull && radius > 2.12 && radius < 2.48) {
      radius = radius < 2.3 ? rand(1.38, 2.12) : rand(2.48, 3.55);
    }
    const y = (Math.random() - 0.5) * (isFull ? 0.022 : 0.05);
    positions[idx * 3] = Math.cos(angle) * radius;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = Math.sin(angle) * radius;
    sizes[idx] = isFull ? rand(0.1, 0.38) : rand(0.1, 0.42);
    phases[idx] = Math.random() * Math.PI * 2;
    layers[idx] = radius < (isFull ? 2.35 : 2.6) ? 1 : 2;
    golds[idx] = Math.random() < 0.1 ? 1 : 0;
    angles[idx] = angle + Math.PI * 0.5;
    streakLens[idx] = rand(1.0, 1.65);
    idx++;
  }

  for (let i = 0; i < outerCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = rand(isFull ? 3.62 : 3.18, isFull ? 4.35 : 3.82);
    const y = (Math.random() - 0.5) * 0.02;
    positions[idx * 3] = Math.cos(angle) * radius;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = Math.sin(angle) * radius;
    sizes[idx] = isFull ? rand(0.05, 0.2) : rand(0.07, 0.24);
    phases[idx] = Math.random() * Math.PI * 2;
    layers[idx] = 2;
    golds[idx] = Math.random() < 0.04 ? 1 : 0;
    angles[idx] = angle + Math.PI * 0.5;
    streakLens[idx] = rand(0.75, 1.2);
    idx++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aLayer", new THREE.BufferAttribute(layers, 1));
  geo.setAttribute("aGold", new THREE.BufferAttribute(golds, 1));
  geo.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
  geo.setAttribute("aStreakLen", new THREE.BufferAttribute(streakLens, 1));
  return geo;
}

function buildSaturnGeometry(mode: SaturnMode) {
  if (mode === "full" || mode === "hero") return buildLegacySaturnGeometry(mode);
  return buildStructuredSaturnGeometry(mode);
}

function useExcludeUniforms(textZone: TextZone | null | undefined, viewport?: { width: number; height: number }) {
  return useMemo(() => {
    if (!textZone || !viewport) {
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
      uExcludeForce: { value: world.force },
    };
  }, [textZone, viewport?.width, viewport?.height]);
}

export default function SaturnParticles({
  intensity = 1,
  paused = false,
  scale = 1,
  position = [0, 0, 0],
  tilt = 0.42,
  mode = "hero",
  orthographic = true,
  textZone = null,
  viewport,
  celestial = CORE_THEME,
  dotOnly = mode !== "full" && mode !== "hero",
}: SaturnParticlesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(() => buildSaturnGeometry(mode), [mode]);
  const excludeUniforms = useExcludeUniforms(textZone, viewport);
  const rayCount = RAY_COUNT[mode];
  const showRays = rayCount > 0 && !dotOnly;

  const colorUniforms = useMemo(() => {
    if (mode === "card" || mode === "mini") {
      return {
        uCorePrimary: { value: hexToVec3(celestial.secondary) },
        uCoreSecondary: { value: hexToVec3(celestial.secondary) },
        uRingPrimary: { value: hexToVec3(celestial.primary) },
        uRingAccent: { value: hexToVec3(celestial.accent) },
      };
    }
    return {
      uCorePrimary: { value: hexToVec3(celestial.primary) },
      uCoreSecondary: { value: hexToVec3(celestial.secondary) },
      uRingPrimary: { value: hexToVec3(celestial.accent) },
      uRingAccent: { value: hexToVec3(celestial.primary) },
    };
  }, [celestial, mode]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uIntensity: { value: intensity },
      uOrtho: { value: orthographic ? 1 : 0 },
      uDotOnly: { value: dotOnly ? 1 : 0 },
      ...colorUniforms,
      ...excludeUniforms,
    }),
    [intensity, orthographic, dotOnly, colorUniforms, excludeUniforms],
  );

  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uCorePrimary.value.copy(colorUniforms.uCorePrimary.value);
    matRef.current.uniforms.uCoreSecondary.value.copy(colorUniforms.uCoreSecondary.value);
    matRef.current.uniforms.uRingPrimary.value.copy(colorUniforms.uRingPrimary.value);
    matRef.current.uniforms.uRingAccent.value.copy(colorUniforms.uRingAccent.value);
    matRef.current.uniforms.uIntensity.value = intensity;
    matRef.current.uniforms.uDotOnly.value = dotOnly ? 1 : 0;
  }, [colorUniforms, intensity, dotOnly]);

  useFrame((state) => {
    if (groupRef.current && !paused) {
      groupRef.current.rotation.y = state.clock.elapsedTime * ROTATION_SPEED[mode];
    }
    if (matRef.current && !paused) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale} rotation={[tilt, 0, 0.12]}>
      {showRays && (
        <LightRays
          intensity={intensity * (mode === "full" ? 0.28 : 0.55)}
          count={rayCount}
          paused={paused}
          coreOnly={mode === "full"}
        />
      )}
      <points geometry={geometry} renderOrder={3} frustumCulled={false}>
        <shaderMaterial
          ref={matRef}
          vertexShader={saturnMicroVertexShader}
          fragmentShader={saturnMicroFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
