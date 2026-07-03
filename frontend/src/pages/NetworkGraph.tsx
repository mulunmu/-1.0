import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAllEnterprises,
  getEnterprisePK,
  type EnterpriseAssessment,
} from "@/lib/api";
import { RISK_LEVEL_COLORS, RISK_LEVEL_TEXT } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ArrowRight, RotateCcw, Search, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   数据层 — 模拟交易边
   ═══════════════════════════════════════════════════════════════ */

interface MockEdge {
  from: string;
  to: string;
  amount: number;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMockEdges(): MockEdge[] {
  const rng = mulberry32(42);
  const allIds = Array.from({ length: 200 }, (_, i) => `ENT${String(i + 1).padStart(3, "0")}`);
  const shuffled = [...allIds].sort(() => rng() - 0.5);
  const active = new Set(shuffled.slice(0, 80));
  active.add("ENT001");
  active.add("ENT002");
  active.add("ENT003");
  const activeList = [...active];
  const edges: MockEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, amount: Math.floor(10_000 + rng() * 49_990_000) });
  };

  for (const id of activeList) {
    const n = 2 + Math.floor(rng() * 14);
    let added = 0;
    let tries = 0;
    while (added < n && tries < 80) {
      tries++;
      const partner = activeList[Math.floor(rng() * activeList.length)];
      if (partner === id) continue;
      const before = seen.size;
      addEdge(id, partner);
      if (seen.size > before) {
        added++;
        if (rng() > 0.35) addEdge(partner, id);
      }
    }
  }

  while (edges.length < 2000) {
    const from = activeList[Math.floor(rng() * activeList.length)];
    const to = activeList[Math.floor(rng() * activeList.length)];
    addEdge(from, to);
    if (rng() > 0.4) addEdge(to, from);
  }

  return edges.slice(0, 2000);
}

const MOCK_EDGES = buildMockEdges();
const PREVIEW_EDGE_COUNT = 2347;

/* ═══════════════════════════════════════════════════════════════
   星团预览
   ═══════════════════════════════════════════════════════════════ */

const CLUSTER_DEFS = [
  { id: 0, name: "制造", color: [120, 200, 255] as const, industries: ["制造业", "医药"] },
  { id: 1, name: "科技", color: [100, 220, 255] as const, industries: ["信息技术", "新能源"] },
  { id: 2, name: "贸易", color: [255, 200, 120] as const, industries: ["批发零售", "餐饮", "金融"] },
  { id: 3, name: "物流", color: [180, 255, 180] as const, industries: ["交通运输"] },
  { id: 4, name: "建筑", color: [255, 160, 120] as const, industries: ["建筑业"] },
] as const;

const PREVIEW_ORBIT = 380;
const CLUSTER_CORE = 52;
const CLUSTER_OUTER = 128;
const ROT_SPEED = (0.04 * Math.PI) / 180;
const PREVIEW_FADE_MS = 500;
const TRANSITION_MS = 800;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const INERTIA_DECAY = 0.95;
const INERTIA_STOP = 0.1;
const RING_BASE = 200;

const EXAMPLE_BUTTONS = [
  { label: "深圳明达", query: "深圳明达" },
  { label: "ENT001", query: "ENT001" },
  { label: "制造业星团", query: "__cluster_manufacturing__" },
] as const;

interface PreviewNode {
  id: string;
  cluster: number;
  x: number;
  y: number;
  r: number;
  phase: number;
  breathPeriod: number;
  rgb: [number, number, number];
  layer: "core" | "outer";
}

interface PreviewLink {
  fromIdx: number;
  toIdx: number;
  cross: boolean;
}

interface PreviewGraph {
  nodes: PreviewNode[];
  links: PreviewLink[];
  idToIdx: Map<string, number>;
  posMap: Map<string, { x: number; y: number }>;
}

interface Meteor {
  cluster: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

function clusterOf(industry: string): number {
  const hit = CLUSTER_DEFS.find((c) => (c.industries as readonly string[]).includes(industry));
  return hit?.id ?? 0;
}

function clusterCenter(i: number): { x: number; y: number } {
  const angle = (i / CLUSTER_DEFS.length) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * PREVIEW_ORBIT, y: Math.sin(angle) * PREVIEW_ORBIT };
}

function riskRgb(risk: string): [number, number, number] {
  const m: Record<string, [number, number, number]> = {
    低风险: [52, 211, 153],
    中低风险: [96, 165, 250],
    中等风险: [251, 191, 36],
    中高风险: [251, 146, 60],
    高风险: [244, 114, 182],
  };
  return m[risk] ?? [200, 200, 210];
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function buildPreviewGraph(enterprises: EnterpriseAssessment[]): PreviewGraph {
  const byCluster: EnterpriseAssessment[][] = CLUSTER_DEFS.map(() => []);
  enterprises.forEach((ent) => byCluster[clusterOf(ent.industry_l1 ?? "制造业")].push(ent));

  const nodes: PreviewNode[] = [];

  byCluster.forEach((group, ci) => {
    const center = clusterCenter(ci);
    const sorted = [...group].sort((a, b) => a.enterprise_id.localeCompare(b.enterprise_id));
    const coreCount = Math.max(3, Math.floor(sorted.length * 0.35));

    sorted.forEach((ent, i) => {
      const h = hashId(ent.enterprise_id);
      const isCore = i < coreCount;
      const layer: "core" | "outer" = isCore ? "core" : "outer";
      const angle = (i / Math.max(sorted.length, 1)) * Math.PI * 2 + (h % 360) * 0.014;
      const distRatio = isCore ? Math.pow((h % 1000) / 1000, 0.55) : 0.55 + ((h % 700) / 700) * 0.45;
      const spread = isCore ? CLUSTER_CORE : CLUSTER_CORE + CLUSTER_OUTER * distRatio;
      const jitter = ((h % 50) - 25) * 0.15;

      nodes.push({
        id: ent.enterprise_id,
        cluster: ci,
        x: center.x + Math.cos(angle) * spread + jitter,
        y: center.y + Math.sin(angle) * spread + jitter * 0.6,
        r: isCore ? 2.8 + (h % 4) * 0.35 : 1.8 + (h % 3) * 0.3,
        phase: ((h % 1000) / 1000) * Math.PI * 2,
        breathPeriod: 1.2 + ((h % 500) / 500) * 2.8,
        rgb: riskRgb(ent.risk_level),
        layer,
      });
    });
  });

  const idToIdx = new Map(nodes.map((n, i) => [n.id, i]));
  const posMap = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const links: PreviewLink[] = [];
  const linkSet = new Set<string>();

  const addLink = (a: number, b: number, cross: boolean) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (linkSet.has(key)) return;
    linkSet.add(key);
    links.push({ fromIdx: a, toIdx: b, cross });
  };

  byCluster.forEach((group) => {
    const idxs = group.map((e) => idToIdx.get(e.enterprise_id)!).filter((x) => x !== undefined);
    idxs.forEach((aIdx, i) => {
      for (let k = 1; k <= 4; k++) addLink(aIdx, idxs[(i + k) % idxs.length], false);
      idxs.forEach((bIdx) => {
        if (aIdx >= bIdx) return;
        const na = nodes[aIdx];
        const nb = nodes[bIdx];
        if (Math.hypot(na.x - nb.x, na.y - nb.y) < 55) addLink(aIdx, bIdx, false);
      });
    });
  });

  MOCK_EDGES.forEach((e) => {
    const a = idToIdx.get(e.from);
    const b = idToIdx.get(e.to);
    if (a === undefined || b === undefined) return;
    if (nodes[a].cluster !== nodes[b].cluster) addLink(a, b, true);
  });

  CLUSTER_DEFS.forEach((_, i) => {
    const next = (i + 1) % CLUSTER_DEFS.length;
    const aList = nodes.filter((n) => n.cluster === i);
    const bList = nodes.filter((n) => n.cluster === next);
    if (aList.length && bList.length) {
      addLink(
        idToIdx.get(aList[hashId(String(i)) % aList.length].id)!,
        idToIdx.get(bList[hashId(String(next)) % bList.length].id)!,
        true,
      );
    }
  });

  return { nodes, links, idToIdx, posMap };
}

function fitPreviewScale(nodes: PreviewNode[], w: number, h: number): number {
  let maxR = PREVIEW_ORBIT + CLUSTER_CORE + CLUSTER_OUTER + 60;
  nodes.forEach((n) => { maxR = Math.max(maxR, Math.hypot(n.x, n.y) + 40); });
  return Math.min(Math.max(Math.min(w, h) / (maxR * 2.1), 0.45), 1.15);
}

/* ═══════════════════════════════════════════════════════════════
   子图
   ═══════════════════════════════════════════════════════════════ */

type NodeRole = "center" | "seller" | "buyer";

interface GraphNode {
  id: string;
  name: string;
  industry: string;
  score: number;
  risk: string;
  role: NodeRole;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  volume: number;
  radius: number;
  phase: number;
  relatedCount: number;
  opacity: number;
}

interface GraphLink {
  from: string;
  to: string;
  fromIdx: number;
  toIdx: number;
  amount: number;
  particleT: number;
  opacity: number;
}

interface SubGraph {
  centerId: string;
  nodes: GraphNode[];
  links: GraphLink[];
  idToIdx: Map<string, number>;
}

interface Viewport {
  panX: number;
  panY: number;
  scale: number;
}

function edgesForCenter(centerId: string): MockEdge[] {
  return MOCK_EDGES.filter((e) => e.from === centerId || e.to === centerId);
}

function roleOf(centerId: string, otherId: string, edges: MockEdge[]): NodeRole {
  let asSeller = 0;
  let asBuyer = 0;
  edges.forEach((e) => {
    if (e.from === otherId && e.to === centerId) asSeller += e.amount;
    if (e.from === centerId && e.to === otherId) asBuyer += e.amount;
  });
  if (asSeller === 0 && asBuyer === 0) return "buyer";
  return asSeller >= asBuyer ? "seller" : "buyer";
}

function volumeOf(id: string, edges: MockEdge[]): number {
  return edges.reduce((s, e) => (e.from === id || e.to === id ? s + e.amount : s), 0);
}

function roleLabel(role: NodeRole): string {
  if (role === "seller") return "卖方";
  if (role === "buyer") return "买方";
  return "中心";
}

function buildSubGraph(
  centerId: string,
  entMap: Map<string, EnterpriseAssessment>,
  previewPos: Map<string, { x: number; y: number }>,
): SubGraph | null {
  const centerEnt = entMap.get(centerId);
  if (!centerEnt) return null;
  const rawEdges = edgesForCenter(centerId);
  if (rawEdges.length === 0) return null;

  const relatedIds = new Set<string>();
  rawEdges.forEach((e) => {
    if (e.from === centerId) relatedIds.add(e.to);
    if (e.to === centerId) relatedIds.add(e.from);
  });

  const relatedList = [...relatedIds].sort();
  const maxVol = Math.max(volumeOf(centerId, rawEdges), ...relatedList.map((id) => volumeOf(id, rawEdges)), 1);
  const centerStart = previewPos.get(centerId) ?? { x: 0, y: 0 };

  const nodes: GraphNode[] = [
    {
      id: centerId,
      name: centerEnt.enterprise_name,
      industry: centerEnt.industry_l1 ?? "—",
      score: centerEnt.overall_score,
      risk: centerEnt.risk_level,
      role: "center",
      x: centerStart.x,
      y: centerStart.y,
      targetX: 0,
      targetY: 0,
      startX: centerStart.x,
      startY: centerStart.y,
      volume: volumeOf(centerId, rawEdges),
      radius: 12 + Math.sqrt(volumeOf(centerId, rawEdges) / maxVol) * 9,
      phase: 0,
      relatedCount: relatedList.length,
      opacity: 1,
    },
  ];

  relatedList.forEach((id, i) => {
    const ent = entMap.get(id);
    const angle = (i / relatedList.length) * Math.PI * 2 - Math.PI / 2;
    const ring = RING_BASE + Math.min(relatedList.length * 8, 140);
    const vol = volumeOf(id, rawEdges);
    const start = previewPos.get(id) ?? {
      x: Math.cos(angle) * ring * 1.6,
      y: Math.sin(angle) * ring * 1.6,
    };
    nodes.push({
      id,
      name: ent?.enterprise_name ?? id,
      industry: ent?.industry_l1 ?? "—",
      score: ent?.overall_score ?? 0,
      risk: ent?.risk_level ?? "中等风险",
      role: roleOf(centerId, id, rawEdges),
      x: start.x,
      y: start.y,
      targetX: Math.cos(angle) * ring,
      targetY: Math.sin(angle) * ring,
      startX: start.x,
      startY: start.y,
      volume: vol,
      radius: 5 + Math.sqrt(vol / maxVol) * 7,
      phase: (i / relatedList.length) * Math.PI * 2,
      relatedCount: edgesForCenter(id).length,
      opacity: 1,
    });
  });

  const idToIdx = new Map(nodes.map((n, i) => [n.id, i]));
  const links: GraphLink[] = rawEdges
    .filter((e) => idToIdx.has(e.from) && idToIdx.has(e.to))
    .map((e, i) => ({
      from: e.from,
      to: e.to,
      fromIdx: idToIdx.get(e.from)!,
      toIdx: idToIdx.get(e.to)!,
      amount: e.amount,
      particleT: (i % 10) / 10,
      opacity: 0,
    }));

  return { centerId, nodes, links, idToIdx };
}

function fitGraphScale(nodes: GraphNode[], w: number, h: number): number {
  if (nodes.length === 0) return 1;
  let maxR = 0;
  nodes.forEach((n) => {
    maxR = Math.max(maxR, Math.hypot(n.targetX, n.targetY) + n.radius * 4 + 50);
  });
  return Math.min(Math.max(Math.min(w, h) / (maxR * 2.1), ZOOM_MIN), 1.4);
}

function findEnterprise(query: string, registry: Map<string, EnterpriseAssessment>): EnterpriseAssessment | null {
  const q = query.trim();
  if (!q) return null;
  if (registry.has(q.toUpperCase())) return registry.get(q.toUpperCase())!;
  for (const ent of registry.values()) {
    if (ent.enterprise_name.includes(q)) return ent;
  }
  return null;
}

function findManufacturingSeed(registry: Map<string, EnterpriseAssessment>): EnterpriseAssessment | null {
  const candidates = [...registry.values()].filter(
    (e) => clusterOf(e.industry_l1 ?? "") === 0 && edgesForCenter(e.enterprise_id).length > 0,
  );
  return candidates.find((e) => e.enterprise_id === "ENT001") ?? candidates[0] ?? null;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function formatAmount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}万`;
  return n.toLocaleString();
}

/* ═══════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════ */

export default function NetworkGraph() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const previewRef = useRef<PreviewGraph | null>(null);
  const graphRef = useRef<SubGraph | null>(null);
  const registryRef = useRef<Map<string, EnterpriseAssessment>>(new Map());

  const viewportRef = useRef<Viewport>({ panX: 0, panY: 0, scale: 1 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const previewAngleRef = useRef(0);
  const previewFadeRef = useRef(1);
  const fadeAnimRef = useRef<{ from: number; to: number; start: number } | null>(null);
  const transitionRef = useRef<{ start: number; active: boolean } | null>(null);
  const scaleAnimRef = useRef<{ from: number; to: number; start: number } | null>(null);

  const meteorsRef = useRef<Meteor[]>([]);
  const nextMeteorAtRef = useRef(performance.now() + 5000 + Math.random() * 5000);
  const lastFrameRef = useRef(0);
  const sizeRef = useRef({ w: 800, h: 600 });
  const rafRef = useRef(0);

  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    pointerId: -1,
  });
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const hoverRef = useRef<GraphNode | null>(null);
  const subgraphIdsRef = useRef(new Set<string>());

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [centerId, setCenterId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mode, setMode] = useState<"preview" | "graph">("preview");
  const [registryReady, setRegistryReady] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);

  const centerNode = useMemo(() => {
    const g = graphRef.current;
    if (!g || !centerId) return null;
    return g.nodes.find((n) => n.id === centerId) ?? null;
  }, [centerId, mode]);

  const relatedTop5 = useMemo(() => {
    const g = graphRef.current;
    if (!g || !centerId) return [];
    const edges = edgesForCenter(centerId);
    const map = new Map<string, { role: NodeRole; amount: number; name: string }>();
    edges.forEach((e) => {
      const other = e.from === centerId ? e.to : e.from;
      const node = g.nodes.find((n) => n.id === other);
      if (!node) return;
      const prev = map.get(other);
      if (!prev || e.amount > prev.amount) {
        map.set(other, { role: node.role, amount: e.amount, name: node.name });
      }
    });
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [centerId, mode]);

  const animatePreviewFade = useCallback((to: number) => {
    fadeAnimRef.current = { from: previewFadeRef.current, to, start: performance.now() };
  }, []);

  const animateScale = useCallback((to: number) => {
    scaleAnimRef.current = { from: viewportRef.current.scale, to, start: performance.now() };
  }, []);

  const loadRegistry = useCallback(async () => {
    const ents = await getAllEnterprises();
    const map = new Map(ents.map((e) => [e.enterprise_id, e]));
    registryRef.current = map;
    previewRef.current = buildPreviewGraph(ents);
    const { w, h } = sizeRef.current;
    if (w > 0 && h > 0 && previewRef.current) {
      viewportRef.current.scale = fitPreviewScale(previewRef.current.nodes, w, h);
    }
    setRegistryReady(true);

    const missing = new Set<string>();
    MOCK_EDGES.forEach((e) => {
      if (!map.has(e.from)) missing.add(e.from);
      if (!map.has(e.to)) missing.add(e.to);
    });
    if (missing.size > 0) {
      const extra = await getEnterprisePK([...missing].slice(0, 40));
      extra.forEach((e) => map.set(e.enterprise_id, e));
    }
  }, []);

  const showSubGraph = useCallback(
    async (targetId: string) => {
      setSearchError("");
      animatePreviewFade(0.05);

      let entMap = registryRef.current;
      if (!entMap.has(targetId)) {
        const [ent] = await getEnterprisePK([targetId]);
        if (ent) entMap = new Map(entMap).set(targetId, ent);
      }

      const relatedIds = new Set<string>();
      edgesForCenter(targetId).forEach((e) => {
        if (e.from === targetId) relatedIds.add(e.to);
        if (e.to === targetId) relatedIds.add(e.from);
      });

      const needFetch = [...relatedIds].filter((id) => !entMap.has(id));
      for (let i = 0; i < needFetch.length; i += 50) {
        const fetched = await getEnterprisePK(needFetch.slice(i, i + 50));
        fetched.forEach((e) => entMap.set(e.enterprise_id, e));
      }
      registryRef.current = entMap;

      const previewPos = previewRef.current?.posMap ?? new Map();
      const angle = previewAngleRef.current;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotatedPos = new Map<string, { x: number; y: number }>();
      previewPos.forEach((p, id) => {
        rotatedPos.set(id, { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });
      });

      const sg = buildSubGraph(targetId, entMap, rotatedPos);
      if (!sg) {
        setSearchError("该企业暂无模拟交易关联数据");
        graphRef.current = null;
        setCenterId(null);
        setMode("preview");
        setPanelVisible(false);
        animatePreviewFade(1);
        return;
      }

      const ent = entMap.get(targetId);
      if (ent) setSearch(ent.enterprise_name);

      subgraphIdsRef.current = new Set(sg.nodes.map((n) => n.id));
      graphRef.current = sg;
      setCenterId(targetId);
      setMode("graph");
      setPanelVisible(true);
      transitionRef.current = { start: performance.now(), active: true };

      const { w, h } = sizeRef.current;
      animateScale(fitGraphScale(sg.nodes, w, h));
      viewportRef.current.panX = 0;
      viewportRef.current.panY = 0;
      velocityRef.current = { vx: 0, vy: 0 };
    },
    [animatePreviewFade, animateScale],
  );

  const runSearch = useCallback(
    async (query: string) => {
      if (query === "__cluster_manufacturing__") {
        const seed = findManufacturingSeed(registryRef.current);
        if (!seed) {
          setSearchError("制造业星团暂无可用交易样本");
          return;
        }
        setSearch(seed.enterprise_name);
        await showSubGraph(seed.enterprise_id);
        return;
      }
      const found = findEnterprise(query, registryRef.current);
      if (!found) {
        setSearchError("未找到匹配企业，请尝试企业名称或编号");
        return;
      }
      setSearch(found.enterprise_name.includes(query) ? query : found.enterprise_name);
      await showSubGraph(found.enterprise_id);
    },
    [showSubGraph],
  );

  const handleSearch = useCallback(async () => {
    setSearching(true);
    try {
      await runSearch(search.trim());
    } finally {
      setSearching(false);
    }
  }, [search, runSearch]);

  const handleExample = useCallback(
    async (query: string) => {
      setSearchError("");
      setSearching(true);
      try {
        await runSearch(query);
      } finally {
        setSearching(false);
      }
    },
    [runSearch],
  );

  const resetView = useCallback(() => {
    graphRef.current = null;
    subgraphIdsRef.current.clear();
    setCenterId(null);
    setHoverId(null);
    hoverRef.current = null;
    setMode("preview");
    setPanelVisible(false);
    setSearchError("");
    previewFadeRef.current = 1;
    fadeAnimRef.current = null;
    transitionRef.current = null;
    scaleAnimRef.current = null;
    velocityRef.current = { vx: 0, vy: 0 };
    const { w, h } = sizeRef.current;
    if (previewRef.current) viewportRef.current.scale = fitPreviewScale(previewRef.current.nodes, w, h);
    viewportRef.current.panX = 0;
    viewportRef.current.panY = 0;
  }, []);

  useEffect(() => {
    loadRegistry().catch(() => setSearchError("企业名录加载失败"));
  }, [loadRegistry]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width <= 0 || height <= 0) return;
      sizeRef.current = { w: width, h: height };
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(devicePixelRatio, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      if (mode === "graph" && graphRef.current) {
        if (!scaleAnimRef.current) {
          viewportRef.current.scale = fitGraphScale(graphRef.current.nodes, width, height);
        }
      } else if (previewRef.current) {
        viewportRef.current.scale = fitPreviewScale(previewRef.current.nodes, width, height);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [registryReady, mode]);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { w, h } = sizeRef.current;
    const vp = viewportRef.current;
    return {
      x: (sx - w / 2) / vp.scale + vp.panX,
      y: (sy - h / 2) / vp.scale + vp.panY,
    };
  }, []);

  const hitTest = useCallback(
    (sx: number, sy: number): GraphNode | null => {
      const g = graphRef.current;
      if (!g || mode !== "graph") return null;
      const { x, y } = screenToWorld(sx, sy);
      const vp = viewportRef.current;
      let best: GraphNode | null = null;
      let bestD = Infinity;
      g.nodes.forEach((node) => {
        if (node.opacity < 0.2) return;
        const dx = node.x - x;
        const dy = node.y - y;
        const hitR = Math.max(node.radius * 2.2, 14 / vp.scale);
        const d = dx * dx + dy * dy;
        if (d < hitR * hitR && d < bestD) {
          bestD = d;
          best = node;
        }
      });
      return best;
    },
    [mode, screenToWorld],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio, 2);

    const spawnMeteor = (now: number) => {
      const ci = Math.floor(Math.random() * CLUSTER_DEFS.length);
      const cc = clusterCenter(ci);
      const angle = Math.random() * Math.PI * 2;
      const dist = CLUSTER_CORE * 0.3;
      const speed = 2.8 + Math.random() * 2.2;
      const dir = angle + Math.PI * 0.35;
      meteorsRef.current.push({
        cluster: ci,
        x: cc.x + Math.cos(angle) * dist,
        y: cc.y + Math.sin(angle) * dist,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        life: 0,
        maxLife: 55 + Math.random() * 35,
      });
      nextMeteorAtRef.current = now + 5000 + Math.random() * 5000;
    };

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      const dt = lastFrameRef.current ? Math.min(now - lastFrameRef.current, 32) : 16;
      lastFrameRef.current = now;

      const { w, h } = sizeRef.current;
      const vp = viewportRef.current;
      const preview = previewRef.current;
      const g = graphRef.current;
      const isPreview = mode === "preview" || previewFadeRef.current > 0.06;

      if (isPreview && !transitionRef.current?.active) {
        previewAngleRef.current += ROT_SPEED * (dt / 1000);
      }

      if (!dragRef.current.active && Math.hypot(velocityRef.current.vx, velocityRef.current.vy) > INERTIA_STOP) {
        vp.panX += velocityRef.current.vx;
        vp.panY += velocityRef.current.vy;
        velocityRef.current.vx *= INERTIA_DECAY;
        velocityRef.current.vy *= INERTIA_DECAY;
      } else if (!dragRef.current.active) {
        velocityRef.current.vx = 0;
        velocityRef.current.vy = 0;
      }

      if (fadeAnimRef.current) {
        const { from, to, start } = fadeAnimRef.current;
        const t = Math.min(1, (now - start) / PREVIEW_FADE_MS);
        previewFadeRef.current = from + (to - from) * easeOutCubic(t);
        if (t >= 1) fadeAnimRef.current = null;
      }

      if (scaleAnimRef.current) {
        const { from, to, start } = scaleAnimRef.current;
        const t = Math.min(1, (now - start) / TRANSITION_MS);
        vp.scale = from + (to - from) * easeOutCubic(t);
        if (t >= 1) scaleAnimRef.current = null;
      }

      let transitionT = 1;
      if (transitionRef.current?.active) {
        transitionT = Math.min(1, (now - transitionRef.current.start) / TRANSITION_MS);
        if (transitionT >= 1) transitionRef.current.active = false;
        const ease = easeOutCubic(transitionT);
        if (g) {
          g.nodes.forEach((node) => {
            node.x = node.startX + (node.targetX - node.startX) * ease;
            node.y = node.startY + (node.targetY - node.startY) * ease;
            node.opacity = ease;
          });
          g.links.forEach((link) => { link.opacity = ease; });
        }
      }

      if (now >= nextMeteorAtRef.current && isPreview) spawnMeteor(now);
      meteorsRef.current = meteorsRef.current
        .map((m) => ({ ...m, x: m.x + m.vx, y: m.y + m.vy, life: m.life + 1 }))
        .filter((m) => m.life < m.maxLife);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#161616";
      ctx.fillRect(0, 0, w, h);

      const applyCamera = (rot = 0) => {
        ctx.translate(w / 2, h / 2);
        ctx.scale(vp.scale, vp.scale);
        ctx.translate(-vp.panX, -vp.panY);
        if (rot) ctx.rotate(rot);
      };

      if (preview && previewFadeRef.current > 0.01) {
        ctx.save();
        ctx.globalAlpha = previewFadeRef.current;
        applyCamera(previewAngleRef.current);

        preview.links.forEach((link) => {
          const a = preview.nodes[link.fromIdx];
          const b = preview.nodes[link.toIdx];
          const inSub = subgraphIdsRef.current.has(a.id) && subgraphIdsRef.current.has(b.id);
          const fadeOut = mode === "graph" && transitionT < 1 && !inSub ? 1 - transitionT : 1;
          if (fadeOut <= 0) return;
          const clusterColor = CLUSTER_DEFS[a.cluster].color;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          if (link.cross) {
            ctx.strokeStyle = `rgba(${clusterColor[0]},${clusterColor[1]},${clusterColor[2]},${0.06 * fadeOut})`;
            ctx.lineWidth = 0.5;
          } else {
            ctx.strokeStyle = `rgba(255,255,255,${0.08 * fadeOut})`;
            ctx.lineWidth = 0.6;
          }
          ctx.globalAlpha = previewFadeRef.current * fadeOut;
          ctx.stroke();
        });

        preview.nodes.forEach((node) => {
          const inSub = subgraphIdsRef.current.has(node.id);
          const unrelatedFade = mode === "graph" && !inSub ? Math.max(0, 1 - transitionT * 1.4) : 1;
          if (unrelatedFade <= 0.01) return;

          const breath = 0.5 + Math.sin(now * 0.001 / node.breathPeriod + node.phase) * 0.5;
          const alpha = (0.25 + breath * 0.25) * unrelatedFade;
          const [r, gCol, b] = node.rgb;
          const glow = node.r * (node.layer === "core" ? 5.5 : 4);

          ctx.globalAlpha = previewFadeRef.current * alpha;
          const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glow);
          grad.addColorStop(0, `rgba(${r},${gCol},${b},${0.9})`);
          grad.addColorStop(0.35, `rgba(${r},${gCol},${b},${0.35})`);
          grad.addColorStop(1, `rgba(${r},${gCol},${b},0)`);
          ctx.beginPath();
          ctx.arc(node.x, node.y, glow, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${gCol},${b},${0.55 + breath * 0.25})`;
          ctx.fill();
        });

        CLUSTER_DEFS.forEach((c, i) => {
          const cc = clusterCenter(i);
          ctx.globalAlpha = previewFadeRef.current * 0.55;
          ctx.font = "12px Inter, PingFang SC, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(${c.color[0]},${c.color[1]},${c.color[2]},0.75)`;
          ctx.fillText(c.name, cc.x, cc.y - CLUSTER_CORE - CLUSTER_OUTER * 0.35 - 10);
        });

        meteorsRef.current.forEach((m) => {
          const t = 1 - m.life / m.maxLife;
          const cc = CLUSTER_DEFS[m.cluster].color;
          ctx.globalAlpha = previewFadeRef.current * t * 0.85;
          ctx.strokeStyle = `rgba(${cc[0]},${cc[1]},${cc[2]},${t})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 10, m.y - m.vy * 10);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(m.x, m.y, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${t})`;
          ctx.fill();
        });

        ctx.restore();
      }

      if (g && mode === "graph") {
        ctx.save();
        applyCamera();

        const maxAmt = Math.max(...g.links.map((l) => l.amount), 1);
        const pulse = 0.6 + Math.sin(now * 0.003) * 0.2;

        g.links.forEach((link) => {
          if (link.opacity < 0.05) return;
          const a = g.nodes[link.fromIdx];
          const b = g.nodes[link.toIdx];
          const alpha = (0.22 + (link.amount / maxAmt) * 0.4) * link.opacity;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(6,182,212,${alpha})`;
          ctx.lineWidth = 0.7 + (link.amount / maxAmt) * 2.2;
          ctx.stroke();

          link.particleT = (link.particleT + 0.005) % 1;
          const px = a.x + (b.x - a.x) * link.particleT;
          const py = a.y + (b.y - a.y) * link.particleT;
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34,211,238,${alpha * 1.4})`;
          ctx.fill();
        });

        g.nodes.forEach((node) => {
          if (node.opacity < 0.05) return;
          const isCenter = node.role === "center";
          const isHover = hoverRef.current?.id === node.id;
          const isActive = centerId === node.id;
          const r = isCenter ? node.radius * (1 + pulse * 0.1) : node.radius;
          const haloR = r * (isCenter ? 5.5 : isHover || isActive ? 4.2 : 3.4);
          const nodeAlpha = node.opacity;

          const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloR);
          if (isCenter) {
            grad.addColorStop(0, `rgba(255,255,255,${0.95 * pulse * nodeAlpha})`);
            grad.addColorStop(0.35, `rgba(255,255,255,${0.3 * pulse * nodeAlpha})`);
            grad.addColorStop(1, "rgba(255,255,255,0)");
          } else if (node.role === "seller") {
            grad.addColorStop(0, `rgba(6,182,212,${0.9 * nodeAlpha})`);
            grad.addColorStop(0.45, `rgba(6,182,212,${0.18 * nodeAlpha})`);
            grad.addColorStop(1, "rgba(6,182,212,0)");
          } else {
            grad.addColorStop(0, `rgba(236,72,153,${0.9 * nodeAlpha})`);
            grad.addColorStop(0.45, `rgba(236,72,153,${0.18 * nodeAlpha})`);
            grad.addColorStop(1, "rgba(236,72,153,0)");
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle = isCenter ? "#ffffff" : node.role === "seller" ? "#06b6d4" : "#ec4899";
          ctx.globalAlpha = nodeAlpha;
          ctx.fill();
          ctx.globalAlpha = 1;

          if (isHover || isActive) {
            ctx.font = "12px Inter, PingFang SC, sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = `rgba(255,255,255,${0.85 * nodeAlpha})`;
            const label = node.name.length > 14 ? `${node.name.slice(0, 13)}…` : node.name;
            ctx.fillText(label, node.x, node.y - r - 12);
          }
        });

        ctx.restore();
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [registryReady, mode, centerId]);

  const zoomAt = useCallback((mx: number, my: number, factor: number) => {
    const vp = viewportRef.current;
    const before = screenToWorld(mx, my);
    vp.scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vp.scale * factor));
    const after = screenToWorld(mx, my);
    vp.panX += before.x - after.x;
    vp.panY += before.y - after.y;
    scaleAnimRef.current = null;
  }, [screenToWorld]);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    zoomAt(mx, my, factor);
  }, [zoomAt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { dist, scale: viewportRef.current.scale };
      dragRef.current.active = false;
      return;
    }
    dragRef.current = {
      active: true,
      lastX: e.clientX,
      lastY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    };
    velocityRef.current = { vx: 0, vy: 0 };
    scaleAnimRef.current = null;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = (pts[0].x + pts[1].x) / 2 - rect.left;
        const my = (pts[0].y + pts[1].y) / 2 - rect.top;
        const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchRef.current.scale * (dist / pinchRef.current.dist)));
        const before = screenToWorld(mx, my);
        viewportRef.current.scale = newScale;
        const after = screenToWorld(mx, my);
        viewportRef.current.panX += before.x - after.x;
        viewportRef.current.panY += before.y - after.y;
      }
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect && mode === "graph") {
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      hoverRef.current = node;
      setHoverId(node?.id ?? null);
    }

    if (!dragRef.current.active) return;
    const vp = viewportRef.current;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    vp.panX -= dx / vp.scale;
    vp.panY -= dy / vp.scale;
    velocityRef.current.vx = -dx / vp.scale;
    velocityRef.current.vy = -dy / vp.scale;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (dragRef.current.pointerId === e.pointerId) {
      dragRef.current.active = false;
    }
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onClick = (e: React.MouseEvent) => {
    if (mode !== "graph") return;
    if (Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) > 8) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (node) {
      setCenterId(node.id);
      if (node.role !== "center") {
        showSubGraph(node.id);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed top-0 right-0 bottom-0 left-0 z-30 md:left-56 bg-[#161616]"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (!dragRef.current.active) {
            hoverRef.current = null;
            setHoverId(null);
          }
        }}
        onClick={onClick}
      />

      {/* 搜索 — 左上角 glass */}
      <div className="absolute top-4 left-4 z-20 w-[min(100%-2rem,380px)] pointer-events-none">
        <div className="glass-panel rounded-2xl p-3 pointer-events-auto">
          <div className="flex gap-2 items-center">
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSearchError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={mode === "preview" ? "探索企业交易网络" : "搜索其他企业..."}
              disabled={searching || !registryReady}
              className="flex-1 min-w-0 h-10 text-sm bg-white/[0.05] border-white/12"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !registryReady}
              aria-label="搜索"
              className="rounded-lg border border-white/10 bg-white/[0.06] p-2.5 text-neutral-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors disabled:opacity-40"
            >
              <Search size={18} />
            </button>
            {mode === "graph" && (
              <button
                type="button"
                onClick={resetView}
                aria-label="返回星团"
                className="rounded-lg border border-white/10 bg-white/[0.06] p-2.5 text-neutral-400 hover:text-white transition-colors"
              >
                <RotateCcw size={17} />
              </button>
            )}
          </div>
          {mode === "preview" && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {EXAMPLE_BUTTONS.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  disabled={searching || !registryReady}
                  onClick={() => handleExample(ex.query)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-neutral-400 hover:border-white/22 hover:bg-white/[0.07] hover:text-neutral-200 disabled:opacity-40 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
          {searchError && <p className="mt-2 text-xs text-red-400/90">{searchError}</p>}
        </div>
      </div>

      {/* 预览底部信息栏 */}
      {mode === "preview" && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="glass-panel rounded-full px-6 py-2.5 text-xs text-neutral-400 whitespace-nowrap">
            200 家交易企业&nbsp;&nbsp;|&nbsp;&nbsp;{PREVIEW_EDGE_COUNT.toLocaleString()} 条交易关系&nbsp;&nbsp;|&nbsp;&nbsp;5 大行业星团
          </div>
        </div>
      )}

      {/* 子图图例 */}
      {mode === "graph" && (
        <div className="absolute bottom-5 left-4 z-20 pointer-events-none">
          <div className="glass-panel rounded-xl px-4 py-3 text-xs text-neutral-400 space-y-1.5">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_white]" />中心企业</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />卖方</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-pink-500" />买方</div>
          </div>
        </div>
      )}

      {/* 右侧详情面板 */}
      <aside
        className={cn(
          "absolute top-0 right-0 bottom-0 z-20 w-80 glass-panel border-l border-white/10 border-r-0 border-t-0 border-b-0 rounded-none pointer-events-auto transition-transform duration-500 ease-out",
          panelVisible && centerNode ? "translate-x-0" : "translate-x-full",
        )}
      >
        {centerNode && (
          <div className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-white leading-snug line-clamp-2">{centerNode.name}</h2>
                <p className="text-xs text-neutral-500 mt-1">{centerNode.industry} · {centerNode.id}</p>
              </div>
              <button
                type="button"
                onClick={resetView}
                className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:bg-white/10 hover:text-white"
                aria-label="关闭面板"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-end gap-3 mt-5">
              <span className={cn("text-4xl font-bold font-mono tabular-nums leading-none", RISK_LEVEL_TEXT[centerNode.risk] ?? "text-white")}>
                {centerNode.score.toFixed(0)}
              </span>
              <Badge className={RISK_LEVEL_COLORS[centerNode.risk] ?? RISK_LEVEL_COLORS["高风险"]}>
                {centerNode.risk}
              </Badge>
            </div>

            <p className="text-xs text-neutral-500 mt-3">
              关联企业 {centerNode.relatedCount} 家 · 交易量 {formatAmount(centerNode.volume)}
            </p>

            <div className="mono-divider my-5 opacity-50" />

            <h3 className="text-xs font-medium text-neutral-400 mb-3">主要关联交易</h3>
            <ul className="flex-1 space-y-2 overflow-y-auto min-h-0 -mr-1 pr-1">
              {relatedTop5.map((rel) => (
                <li key={rel.id}>
                  <button
                    type="button"
                    onClick={() => showSubGraph(rel.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      hoverId === rel.id || centerId === rel.id
                        ? "border-cyan-500/35 bg-cyan-500/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.06]",
                    )}
                  >
                    <p className="text-sm text-neutral-200 truncate">{rel.name}</p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border",
                        rel.role === "seller" ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" : "text-pink-400 border-pink-500/30 bg-pink-500/10",
                      )}>
                        {roleLabel(rel.role)}
                      </span>
                      <span className="text-xs text-neutral-500 tabular-nums">{formatAmount(rel.amount)}</span>
                    </div>
                  </button>
                </li>
              ))}
              {relatedTop5.length === 0 && (
                <li className="text-xs text-neutral-600 py-4 text-center">暂无关联交易</li>
              )}
            </ul>

            <Button
              className="w-full mt-4 bg-white text-black hover:bg-neutral-200"
              onClick={() => navigate(`/enterprise/${centerNode.id}`)}
            >
              查看完整评估
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
