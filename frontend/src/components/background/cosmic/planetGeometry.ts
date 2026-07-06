import * as THREE from "three";

/** 星尘粒子簇 — 视觉表现，非真实天体模拟 */
export interface CelestialCluster {
  primary: string;
  secondary: string;
  accent: string;
  coreCount: number;
  coreRadius: number;
}

/** @deprecated 沿用旧名，减少改动面 */
export type PlanetTheme = CelestialCluster & { name?: string; ring?: never };

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

export function buildPlanetGeometry(theme: CelestialCluster, mode: "nav" | "core" | "mini" = "nav") {
  const total = theme.coreCount;

  const positions = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const shades = new Float32Array(total);
  const layers = new Float32Array(total);

  const shellTight = mode === "core" ? 0.97 : mode === "mini" ? 0.86 : 0.9;
  const shellRange = mode === "core" ? 0.03 : mode === "mini" ? 0.12 : 0.1;
  const sizeMin = mode === "mini" ? 0.09 : mode === "core" ? 0.22 : 0.16;
  const sizeMax = mode === "mini" ? 0.18 : mode === "core" ? 0.42 : 0.36;

  for (let i = 0; i < theme.coreCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = theme.coreRadius * (shellTight + Math.random() * shellRange);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = rand(sizeMin, sizeMax);
    phases[i] = Math.random() * Math.PI * 2;
    shades[i] = Math.random();
    layers[i] = 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geo.setAttribute("aShade", new THREE.BufferAttribute(shades, 1));
  geo.setAttribute("aLayer", new THREE.BufferAttribute(layers, 1));
  return geo;
}

/** Hub 中心星核 — 宇宙能量核心，非真实太阳 */
export const CORE_THEME: CelestialCluster = {
  primary: "#eef4ff",
  secondary: "#7eb8ff",
  accent: "#b8a8ff",
  coreCount: 1100,
  coreRadius: 0.78,
};
