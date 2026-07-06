import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchEnterprises,
  fetchEnterprisePK,
  getInstantEnterprises,
} from "@/lib/dataSource";
import type { EnterpriseAssessment } from "@/lib/api";
import { getInvoiceEdges } from "@/lib/api";
import {
  DIMENSION_LABELS,
  RISK_LEVEL_COLORS,
} from "@/lib/labels";
import { mulberry32 } from "@/lib/mockEnterprises";
import { SEED_ENTERPRISE_A, SEED_ID_A } from "@/lib/constants";
import { RISK_CHART_COLORS } from "@/lib/theme";
import {
  CANVAS_BG,
  CANVAS_CENTER_FILL,
  NODE_RISK_RGB,
  linkRiskRgb,
  HOVER_RING_COLOR,
  CENTER_BORDER_COLOR,
  CLUSTER_LABEL_COLOR,
  rgbFill,
  whiteAlpha,
  previewLinkColor,
} from "@/lib/canvasTheme";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Download,
  Filter,
  Link2,
  AlertTriangle,
  Building2,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   数据层 — 模拟交易边。真实发票边接入点在 buildPreviewGraph()，
   优先真实发票API，回退本地mock。loadRealEdges() 在组件挂载时自动调用。
   ═══════════════════════════════════════════════════════════════ */

interface MockEdge {
  from: string;
  to: string;
  amount: number;
}

function buildMockEdges(): MockEdge[] {
  const rng = mulberry32(42);
  const allIds = Array.from(
    { length: 200 },
    (_, i) => `ENT${String(i + 1).padStart(3, "0")}`,
  );
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
    edges.push({
      from,
      to,
      amount: Math.floor(10_000 + rng() * 49_990_000),
    });
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

// 优先真实发票边 API，回退 mock
let CURRENT_EDGES = buildMockEdges();
let EDGES_SOURCE: "mock" | "live" = "mock";

async function loadRealEdges(): Promise<void> {
  try {
    const edges = await getInvoiceEdges();
    if (edges.length > 0) {
      CURRENT_EDGES = edges.map((e) => ({ from: e.source_id, to: e.target_id, amount: e.amount }));
      EDGES_SOURCE = "live";
    }
  } catch { /* keep mock */ }
}

/* ═══════════════════════════════════════════════════════════════
   颜色系统 — 全部复用全局 RISK_CHART_COLORS / NODE_RISK_RGB
   ═══════════════════════════════════════════════════════════════ */

const RISK_RGB = NODE_RISK_RGB;

function riskRgb(risk: string): [number, number, number] {
  return RISK_RGB[risk] ?? RISK_RGB["中等风险"];
}

/* ═══════════════════════════════════════════════════════════════
   星团预览（完全保留数据结构与旋转逻辑）
   ═══════════════════════════════════════════════════════════════ */

const CLUSTER_DEFS = [
  { id: 0, name: "制造", industries: ["制造业", "医药"] },
  { id: 1, name: "科技", industries: ["信息技术", "新能源"] },
  { id: 2, name: "贸易", industries: ["批发零售", "餐饮", "金融"] },
  { id: 3, name: "物流", industries: ["交通运输"] },
  { id: 4, name: "建筑", industries: ["建筑业"] },
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
  { label: SEED_ENTERPRISE_A, query: SEED_ENTERPRISE_A },
  { label: SEED_ID_A, query: SEED_ID_A },
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

function clusterOf(industry: string): number {
  const hit = CLUSTER_DEFS.find((c) =>
    (c.industries as readonly string[]).includes(industry),
  );
  return hit?.id ?? 0;
}

function clusterCenter(i: number): { x: number; y: number } {
  const angle = (i / CLUSTER_DEFS.length) * Math.PI * 2 - Math.PI / 2;
  return {
    x: Math.cos(angle) * PREVIEW_ORBIT,
    y: Math.sin(angle) * PREVIEW_ORBIT,
  };
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function buildPreviewGraph(
  enterprises: EnterpriseAssessment[],
): PreviewGraph {
  const byCluster: EnterpriseAssessment[][] = CLUSTER_DEFS.map(() => []);
  enterprises.forEach((ent) =>
    byCluster[clusterOf(ent.industry_l1 ?? "制造业")].push(ent),
  );

  const nodes: PreviewNode[] = [];

  byCluster.forEach((group, ci) => {
    const center = clusterCenter(ci);
    const sorted = [...group].sort((a, b) =>
      a.enterprise_id.localeCompare(b.enterprise_id),
    );
    const coreCount = Math.max(3, Math.floor(sorted.length * 0.35));

    sorted.forEach((ent, i) => {
      const h = hashId(ent.enterprise_id);
      const isCore = i < coreCount;
      const layer: "core" | "outer" = isCore ? "core" : "outer";
      const angle =
        (i / Math.max(sorted.length, 1)) * Math.PI * 2 + (h % 360) * 0.014;
      const distRatio = isCore
        ? Math.pow((h % 1000) / 1000, 0.55)
        : 0.55 + ((h % 700) / 700) * 0.45;
      const spread = isCore
        ? CLUSTER_CORE
        : CLUSTER_CORE + CLUSTER_OUTER * distRatio;
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
    const idxs = group
      .map((e) => idToIdx.get(e.enterprise_id)!)
      .filter((x) => x !== undefined);
    idxs.forEach((aIdx, i) => {
      for (let k = 1; k <= 4; k++)
        addLink(aIdx, idxs[(i + k) % idxs.length], false);
      idxs.forEach((bIdx) => {
        if (aIdx >= bIdx) return;
        const na = nodes[aIdx];
        const nb = nodes[bIdx];
        if (Math.hypot(na.x - nb.x, na.y - nb.y) < 55)
          addLink(aIdx, bIdx, false);
      });
    });
  });

  CURRENT_EDGES.forEach((e) => {
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

function fitPreviewScale(
  nodes: PreviewNode[],
  w: number,
  h: number,
): number {
  let maxR = PREVIEW_ORBIT + CLUSTER_CORE + CLUSTER_OUTER + 60;
  nodes.forEach((n) => {
    maxR = Math.max(maxR, Math.hypot(n.x, n.y) + 40);
  });
  return Math.min(
    Math.max(Math.min(w, h) / (maxR * 2.1), 0.45),
    1.15,
  );
}

/* ═══════════════════════════════════════════════════════════════
   子图（完全保留数据结构与布局算法）
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
  return CURRENT_EDGES.filter((e) => e.from === centerId || e.to === centerId);
}

function roleOf(
  centerId: string,
  otherId: string,
  edges: MockEdge[],
): NodeRole {
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
  return edges.reduce(
    (s, e) => (e.from === id || e.to === id ? s + e.amount : s),
    0,
  );
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
  const maxVol = Math.max(
    volumeOf(centerId, rawEdges),
    ...relatedList.map((id) => volumeOf(id, rawEdges)),
    1,
  );
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
    .map((e) => ({
      from: e.from,
      to: e.to,
      fromIdx: idToIdx.get(e.from)!,
      toIdx: idToIdx.get(e.to)!,
      amount: e.amount,
      opacity: 0,
    }));

  return { centerId, nodes, links, idToIdx };
}

function fitGraphScale(
  nodes: GraphNode[],
  w: number,
  h: number,
): number {
  if (nodes.length === 0) return 1;
  let maxR = 0;
  nodes.forEach((n) => {
    maxR = Math.max(
      maxR,
      Math.hypot(n.targetX, n.targetY) + n.radius * 4 + 50,
    );
  });
  return Math.min(
    Math.max(Math.min(w, h) / (maxR * 2.1), ZOOM_MIN),
    1.4,
  );
}

function findEnterprise(
  query: string,
  registry: Map<string, EnterpriseAssessment>,
): EnterpriseAssessment | null {
  const q = query.trim();
  if (!q) return null;
  if (registry.has(q.toUpperCase())) return registry.get(q.toUpperCase())!;
  for (const ent of registry.values()) {
    if (ent.enterprise_name.includes(q)) return ent;
  }
  return null;
}

function findManufacturingSeed(
  registry: Map<string, EnterpriseAssessment>,
): EnterpriseAssessment | null {
  const candidates = [...registry.values()].filter(
    (e) =>
      clusterOf(e.industry_l1 ?? "") === 0 &&
      edgesForCenter(e.enterprise_id).length > 0,
  );
  return (
    candidates.find((e) => e.enterprise_id === "ENT001") ??
    candidates[0] ??
    null
  );
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
   骨架屏
   ═══════════════════════════════════════════════════════════════ */

function NetworkSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <Skeleton className="h-6 w-32 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex flex-[3] items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.01] min-w-0">
          <Skeleton className="aspect-square h-[min(50%,20rem)] w-[min(50%,20rem)] rounded-full" />
        </div>
        <div className="hidden w-64 shrink-0 space-y-3 lg:block xl:w-72">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="min-h-[8rem] flex-1 rounded-lg" />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg sm:h-24" />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════ */

export default function NetworkGraph() {
  const navigate = useNavigate();
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const previewRef = useRef<PreviewGraph | null>(null);
  const graphRef = useRef<SubGraph | null>(null);
  const registryRef = useRef<Map<string, EnterpriseAssessment>>(new Map());

  const viewportRef = useRef<Viewport>({ panX: 0, panY: 0, scale: 1 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const previewAngleRef = useRef(0);
  const previewFadeRef = useRef(1);
  const fadeAnimRef = useRef<{
    from: number;
    to: number;
    start: number;
  } | null>(null);
  const transitionRef = useRef<{
    start: number;
    active: boolean;
  } | null>(null);
  const scaleAnimRef = useRef<{
    from: number;
    to: number;
    start: number;
  } | null>(null);

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
  const [edgesReady, setEdgesReady] = useState(false);

  // 启动时异步加载真实发票边，完成后触发预览重建
  useEffect(() => {
    loadRealEdges().then(() => setEdgesReady(true));
  }, []);

  // 真实边加载完成后重建预览图谱
  useEffect(() => {
    if (!edgesReady || registryRef.current.size === 0) return;
    const ents = [...registryRef.current.values()];
    if (ents.length > 0) {
      previewRef.current = buildPreviewGraph(ents);
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0 && previewRef.current) {
        viewportRef.current.scale = fitPreviewScale(previewRef.current.nodes, w, h);
      }
    }
  }, [edgesReady]);

  const applyRegistry = useCallback((ents: EnterpriseAssessment[]) => {
    const map = new Map(ents.map((e) => [e.enterprise_id, e]));
    registryRef.current = map;
    previewRef.current = buildPreviewGraph(ents);
    const { w, h } = sizeRef.current;
    if (w > 0 && h > 0 && previewRef.current) {
      viewportRef.current.scale = fitPreviewScale(
        previewRef.current.nodes,
        w,
        h,
      );
    }
    setRegistryReady(true);
  }, []);

  /* 筛选状态 */
  const [riskFilter, setRiskFilter] = useState("全部");
  const [industryFilter, setIndustryFilter] = useState("全部");

  /* 根据筛选条件过滤预览图谱节点 */
  const filteredPreviewIds = useMemo(() => {
    const preview = previewRef.current;
    const registry = registryRef.current;
    if (!preview || registry.size === 0) return new Set(preview?.nodes.map((n) => n.id) ?? []);
    const riskActive = riskFilter !== "全部";
    const indActive = industryFilter !== "全部";
    if (!riskActive && !indActive) return new Set(preview.nodes.map((n) => n.id));
    const ids = new Set<string>();
    preview.nodes.forEach((n) => {
      const ent = registry.get(n.id);
      if (!ent) { ids.add(n.id); return; }
      if (riskActive && ent.risk_level !== riskFilter) return;
      if (indActive && ent.industry_l1 !== industryFilter) return;
      ids.add(n.id);
    });
    return ids;
  }, [riskFilter, industryFilter, registryReady]);

  /* ── 派生数据 ── */

  const centerNode = useMemo(() => {
    const g = graphRef.current;
    if (!g || !centerId) return null;
    return g.nodes.find((n) => n.id === centerId) ?? null;
  }, [centerId, mode]);

  const relatedTop5 = useMemo(() => {
    const g = graphRef.current;
    if (!g || !centerId) return [];
    const edges = edgesForCenter(centerId);
    const map = new Map<
      string,
      { role: NodeRole; amount: number; name: string; risk: string; score: number }
    >();
    edges.forEach((e) => {
      const other = e.from === centerId ? e.to : e.from;
      const node = g.nodes.find((n) => n.id === other);
      if (!node) return;
      const prev = map.get(other);
      if (!prev || e.amount > prev.amount) {
        map.set(other, {
          role: node.role,
          amount: e.amount,
          name: node.name,
          risk: node.risk,
          score: node.score,
        });
      }
    });
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [centerId, mode]);

  /* 图谱统计 */
  const graphStats = useMemo(() => {
    const g = graphRef.current;
    if (!g || mode !== "graph") {
      if (previewRef.current) {
        const visibleCount = filteredPreviewIds.size;
        const totalNodes = previewRef.current.nodes.length;
        return {
          totalEdges: CURRENT_EDGES.length,
          totalNodes: visibleCount < totalNodes ? `${visibleCount} / ${totalNodes}` : totalNodes,
          highRiskLinks: (() => {
            // 从 registry 中计算实际高风险边数
            const registry = registryRef.current;
            if (registry.size === 0) return 0;
            let count = 0;
            for (const edge of CURRENT_EDGES) {
              const a = registry.get(edge.from);
              const b = registry.get(edge.to);
              if (a?.risk_level?.includes("高") || b?.risk_level?.includes("高")) count++;
            }
            return count;
          })(),
        };
      }
      return { totalEdges: 0, totalNodes: 0, highRiskLinks: 0 };
    }
    const highRisk = g.links.filter((l) => {
      const a = g.nodes[l.fromIdx];
      const b = g.nodes[l.toIdx];
      return a?.risk?.includes("高") || b?.risk?.includes("高");
    }).length;
    return {
      totalEdges: g.links.length,
      totalNodes: g.nodes.length,
      highRiskLinks: highRisk,
    };
  }, [mode, centerId]);

  /* ── Canvas 渲染控制 ── */

  const animatePreviewFade = useCallback((to: number) => {
    fadeAnimRef.current = {
      from: previewFadeRef.current,
      to,
      start: performance.now(),
    };
  }, []);

  const animateScale = useCallback((to: number) => {
    scaleAnimRef.current = {
      from: viewportRef.current.scale,
      to,
      start: performance.now(),
    };
  }, []);

  /* ── 数据加载 ── */

  const loadRegistry = useCallback(async () => {
    try {
      const ents = await fetchEnterprises();
      applyRegistry(ents);

      const map = registryRef.current;
      const missing = new Set<string>();
      CURRENT_EDGES.forEach((e) => {
        if (!map.has(e.from)) missing.add(e.from);
        if (!map.has(e.to)) missing.add(e.to);
      });
      if (missing.size > 0) {
        const extra = await fetchEnterprisePK([...missing].slice(0, 40));
        extra.forEach((e) => map.set(e.enterprise_id, e));
      }
    } catch {
      applyRegistry(getInstantEnterprises());
    }
  }, [applyRegistry]);

  const showSubGraph = useCallback(
    async (targetId: string) => {
      setSearchError("");
      animatePreviewFade(0.05);

      let entMap = registryRef.current;
      if (!entMap.has(targetId)) {
        const [ent] = await fetchEnterprisePK([targetId]);
        if (ent) entMap = new Map(entMap).set(targetId, ent);
      }

      const relatedIds = new Set<string>();
      edgesForCenter(targetId).forEach((e) => {
        if (e.from === targetId) relatedIds.add(e.to);
        if (e.to === targetId) relatedIds.add(e.from);
      });

      const needFetch = [...relatedIds].filter((id) => !entMap.has(id));
      for (let i = 0; i < needFetch.length; i += 50) {
        const fetched = await fetchEnterprisePK(needFetch.slice(i, i + 50));
        fetched.forEach((e) => entMap.set(e.enterprise_id, e));
      }
      registryRef.current = entMap;

      const previewPos = previewRef.current?.posMap ?? new Map();
      const angle = previewAngleRef.current;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotatedPos = new Map<string, { x: number; y: number }>();
      previewPos.forEach((p, id) => {
        rotatedPos.set(id, {
          x: p.x * cos - p.y * sin,
          y: p.x * sin + p.y * cos,
        });
      });

      const sg = buildSubGraph(targetId, entMap, rotatedPos);
      if (!sg) {
        setSearchError("该企业暂无模拟交易关联数据");
        graphRef.current = null;
        setCenterId(null);
        setMode("preview");
        animatePreviewFade(1);
        return;
      }

      const ent = entMap.get(targetId);
      if (ent) setSearch(ent.enterprise_name);

      subgraphIdsRef.current = new Set(sg.nodes.map((n) => n.id));
      graphRef.current = sg;
      setCenterId(targetId);
      setMode("graph");
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
      setSearch(
        found.enterprise_name.includes(query) ? query : found.enterprise_name,
      );
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
    setSearchError("");
    setSearch("");
    previewFadeRef.current = 1;
    fadeAnimRef.current = null;
    transitionRef.current = null;
    scaleAnimRef.current = null;
    velocityRef.current = { vx: 0, vy: 0 };
    const { w, h } = sizeRef.current;
    if (previewRef.current)
      viewportRef.current.scale = fitPreviewScale(
        previewRef.current.nodes,
        w,
        h,
      );
    viewportRef.current.panX = 0;
    viewportRef.current.panY = 0;
  }, []);

  useEffect(() => {
    applyRegistry(getInstantEnterprises());
    loadRegistry().catch(() => setSearchError("企业名录加载失败"));
  }, [applyRegistry, loadRegistry]);

  /* ── Canvas 尺寸 ── */

  useEffect(() => {
    const el = canvasWrapRef.current;
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
          viewportRef.current.scale = fitGraphScale(
            graphRef.current.nodes,
            width,
            height,
          );
        }
      } else if (previewRef.current) {
        viewportRef.current.scale = fitPreviewScale(
          previewRef.current.nodes,
          width,
          height,
      );
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

  /* ── 坐标转换 ── */

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

  /* ══════════════════════════════════════
     Canvas 渲染循环（核心保留，移除发光/粒子）
     ══════════════════════════════════════ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio, 2);

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      const dt = lastFrameRef.current
        ? Math.min(now - lastFrameRef.current, 32)
        : 16;
      lastFrameRef.current = now;

      const { w, h } = sizeRef.current;
      const vp = viewportRef.current;
      const preview = previewRef.current;
      const g = graphRef.current;
      const isPreview =
        mode === "preview" || previewFadeRef.current > 0.06;

      if (isPreview && !transitionRef.current?.active) {
        previewAngleRef.current += ROT_SPEED * (dt / 1000);
      }

      /* 惯性 */
      if (
        !dragRef.current.active &&
        Math.hypot(velocityRef.current.vx, velocityRef.current.vy) >
          INERTIA_STOP
      ) {
        vp.panX += velocityRef.current.vx;
        vp.panY += velocityRef.current.vy;
        velocityRef.current.vx *= INERTIA_DECAY;
        velocityRef.current.vy *= INERTIA_DECAY;
      } else if (!dragRef.current.active) {
        velocityRef.current.vx = 0;
        velocityRef.current.vy = 0;
      }

      /* 淡入淡出 */
      if (fadeAnimRef.current) {
        const { from, to, start } = fadeAnimRef.current;
        const t = Math.min(1, (now - start) / PREVIEW_FADE_MS);
        previewFadeRef.current = from + (to - from) * easeOutCubic(t);
        if (t >= 1) fadeAnimRef.current = null;
      }

      /* 缩放动画 */
      if (scaleAnimRef.current) {
        const { from, to, start } = scaleAnimRef.current;
        const t = Math.min(1, (now - start) / TRANSITION_MS);
        vp.scale = from + (to - from) * easeOutCubic(t);
        if (t >= 1) scaleAnimRef.current = null;
      }

      /* 过渡 */
      let transitionT = 1;
      if (transitionRef.current?.active) {
        transitionT = Math.min(
          1,
          (now - transitionRef.current.start) / TRANSITION_MS,
        );
        if (transitionT >= 1) transitionRef.current.active = false;
        const ease = easeOutCubic(transitionT);
        if (g) {
          g.nodes.forEach((node) => {
            node.x =
              node.startX + (node.targetX - node.startX) * ease;
            node.y =
              node.startY + (node.targetY - node.startY) * ease;
            node.opacity = ease;
          });
          g.links.forEach((link) => {
            link.opacity = ease;
          });
        }
      }

      /* 清画布 */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, w, h);

      const applyCamera = (rot = 0) => {
        ctx.translate(w / 2, h / 2);
        ctx.scale(vp.scale, vp.scale);
        ctx.translate(-vp.panX, -vp.panY);
        if (rot) ctx.rotate(rot);
      };

      /* ── 绘制预览星团 ── */
      if (preview && previewFadeRef.current > 0.01) {
        ctx.save();
        ctx.globalAlpha = previewFadeRef.current;
        applyCamera(previewAngleRef.current);

        /* 连线（仅两端都在过滤结果中的连线） */
        preview.links.forEach((link) => {
          const a = preview.nodes[link.fromIdx];
          const b = preview.nodes[link.toIdx];
          if (!filteredPreviewIds.has(a.id) || !filteredPreviewIds.has(b.id)) return;
          const inSub =
            subgraphIdsRef.current.has(a.id) &&
            subgraphIdsRef.current.has(b.id);
          const fadeOut =
            mode === "graph" && transitionT < 1 && !inSub
              ? 1 - transitionT
              : 1;
          if (fadeOut <= 0) return;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          if (link.cross) {
            ctx.strokeStyle = previewLinkColor(fadeOut, "cross");
            ctx.lineWidth = 0.4;
          } else {
            ctx.strokeStyle = previewLinkColor(fadeOut, "inner");
            ctx.lineWidth = 0.5;
          }
          ctx.stroke();
        });

        /* 节点 — 仅渲染过滤后的节点 */
        preview.nodes.forEach((node) => {
          if (!filteredPreviewIds.has(node.id)) return;
          const inSub = subgraphIdsRef.current.has(node.id);
          const unrelatedFade =
            mode === "graph" && !inSub
              ? Math.max(0, 1 - transitionT * 1.4)
              : 1;
          if (unrelatedFade <= 0.01) return;

          const breath =
            0.6 +
            Math.sin(
              (now * 0.001) / node.breathPeriod + node.phase,
            ) *
              0.15;
          const alpha =
            (node.layer === "core" ? 0.65 : 0.4) * unrelatedFade * breath;
          const [r, gCol, b] = node.rgb;

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
          ctx.fillStyle = rgbFill([r, gCol, b] as [number, number, number], alpha);
          ctx.fill();

          /* 细边框 */
          ctx.strokeStyle = rgbFill([r, gCol, b] as [number, number, number], alpha * 0.5);
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });

        /* 星团标签 */
        CLUSTER_DEFS.forEach((c, i) => {
          const cc = clusterCenter(i);
          ctx.globalAlpha = previewFadeRef.current * 0.5;
          ctx.font = "11px Inter, PingFang SC, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = CLUSTER_LABEL_COLOR;
          ctx.fillText(
            c.name,
            cc.x,
            cc.y - CLUSTER_CORE - CLUSTER_OUTER * 0.35 - 8,
          );
        });

        ctx.restore();
      }

      /* ── 绘制子图 ── */
      if (g && mode === "graph") {
        ctx.save();
        applyCamera();

        const maxAmt = Math.max(...g.links.map((l) => l.amount), 1);

        /* 连线 — 纯色，无粒子动画，粗细表示交易规模 */
        g.links.forEach((link) => {
          if (link.opacity < 0.05) return;
          const a = g.nodes[link.fromIdx];
          const b = g.nodes[link.toIdx];
          const width =
            0.5 + (link.amount / maxAmt) * 2.5;
          const alpha = (0.25 + (link.amount / maxAmt) * 0.35) * link.opacity;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          /* 连线颜色匹配风险较高的节点 */
          const riskColor =
            a.risk === "高风险" || b.risk === "高风险"
              ? riskRgb("高风险")
              : a.risk === "中高风险" || b.risk === "中高风险"
                ? riskRgb("中高风险")
                : ([161, 161, 170] as [number, number, number]);
          ctx.strokeStyle = rgbFill(riskColor, alpha);
          ctx.lineWidth = width;
          ctx.stroke();
        });

        /* 节点 — 纯色填充，无发光光晕 */
        g.nodes.forEach((node) => {
          if (node.opacity < 0.05) return;
          const isCenter = node.role === "center";
          const isHover = hoverRef.current?.id === node.id;
          const isActive = centerId === node.id;
          const r = node.radius;
          const nodeAlpha = node.opacity;

          /* 选中/悬停外环 */
          if ((isHover || isActive) && !isCenter) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = HOVER_RING_COLOR;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          /* 实体填充 */
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

          if (isCenter) {
            ctx.fillStyle = CANVAS_CENTER_FILL;
          } else {
            const [rr, gg, bb] = riskRgb(node.risk);
            ctx.fillStyle = rgbFill([rr, gg, bb] as [number, number, number], 0.85 * nodeAlpha);
          }
          ctx.fill();

          /* 边框 */
          ctx.strokeStyle = isCenter
            ? CENTER_BORDER_COLOR
            : whiteAlpha(0.15 * nodeAlpha);
          ctx.lineWidth = isCenter ? 1.5 : 0.8;
          ctx.stroke();

          /* 标签 */
          if (isHover || isActive || isCenter) {
            ctx.font = "11px Inter, PingFang SC, sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = whiteAlpha(0.85 * nodeAlpha);
            const label =
              node.name.length > 12
                ? `${node.name.slice(0, 11)}…`
                : node.name;
            ctx.fillText(label, node.x, node.y - r - 10);
          }
        });

        ctx.restore();
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [registryReady, mode, centerId]);

  /* ── 缩放 / 交互 ── */

  const zoomAt = useCallback(
    (mx: number, my: number, factor: number) => {
      const vp = viewportRef.current;
      const before = screenToWorld(mx, my);
      vp.scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vp.scale * factor));
      const after = screenToWorld(mx, my);
      vp.panX += before.x - after.x;
      vp.panY += before.y - after.y;
      scaleAnimRef.current = null;
    },
    [screenToWorld],
  );

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      zoomAt(mx, my, factor);
    },
    [zoomAt],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
    });
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
    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
    });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = (pts[0].x + pts[1].x) / 2 - rect.left;
        const my = (pts[0].y + pts[1].y) / 2 - rect.top;
        const newScale = Math.max(
          ZOOM_MIN,
          Math.min(
            ZOOM_MAX,
            pinchRef.current.scale * (dist / pinchRef.current.dist),
          ),
        );
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
    if (
      Math.hypot(
        e.clientX - dragRef.current.startX,
        e.clientY - dragRef.current.startY,
      ) > 8
    )
      return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (node) {
      setCenterId(node.id);
      if (node.role !== "center") {
        showSubGraph(node.id);
      }
    }
  };

  /* ── 加载状态 ── */

  /* ══════════════════════════════════════
     渲染
     ══════════════════════════════════════ */

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden sm:gap-3">
      <div data-reveal className="shrink-0">
      {/* ═══ 顶部控制栏 ═══ */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-neutral-100">
              交易网络
            </h1>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              企业图谱 · 关系挖掘
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 风险等级筛选 */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="h-8 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 text-xs text-neutral-300 outline-none focus:border-blue-500/40 transition-colors duration-200 ease-out"
          >
            <option value="全部">全部风险</option>
            <option value="高风险">高风险</option>
            <option value="中高风险">中高风险</option>
            <option value="中等风险">中等风险</option>
            <option value="中低风险">中低风险</option>
            <option value="低风险">低风险</option>
          </select>

          {/* 行业筛选 */}
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="h-8 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 text-xs text-neutral-300 outline-none focus:border-blue-500/40 transition-colors duration-200 ease-out"
          >
            <option value="全部">全部行业</option>
            <option value="制造业">制造业</option>
            <option value="信息技术">信息技术</option>
            <option value="批发零售">批发零售</option>
            <option value="新能源">新能源</option>
            <option value="建筑业">建筑业</option>
          </select>

          {/* 重置 */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetView}
            className="h-8 border-white/[0.1] text-xs gap-1.5 hover:bg-white/[0.06] hover:border-white/[0.18] active:bg-white/[0.1] transition-colors duration-200 ease-out"
          >
            <RotateCcw size={13} />
            重置
          </Button>

          {/* 导出图谱为PNG */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const link = document.createElement("a");
              link.download = "交易网络图谱.png";
              link.href = canvas.toDataURL("image/png");
              link.click();
            }}
            className="h-8 border-white/[0.1] text-xs gap-1.5 hover:bg-white/[0.06] hover:border-white/[0.18] active:bg-white/[0.1] transition-colors duration-200 ease-out"
          >
            <Download size={13} />
            导出
          </Button>
        </div>
      </div>
      </div>

      {/* ═══ 主体双栏 ═══ */}
      <div data-reveal className="flex min-h-0 flex-1 gap-2 sm:gap-3">
        {/* ── 左栏 75%：Canvas 图谱 ── */}
        <div className="flex-[3] min-w-0 relative rounded-lg border border-white/[0.06] bg-[var(--color-bg-elevated)] overflow-hidden">
          {/* Canvas */}
          <div
            ref={canvasWrapRef}
            className="absolute inset-0"
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
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
          </div>

          {/* 搜索浮层 */}
          <div className="absolute top-3 left-3 z-10">
            <div className="flex gap-1.5 items-center">
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={
                  mode === "preview" ? "搜索企业或编号…" : "搜索其他企业…"
                }
                disabled={searching || !registryReady}
                className="w-48 sm:w-56 h-8 text-xs bg-white/[0.04] border-white/[0.1]"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !registryReady}
                aria-label="搜索"
                className="rounded-lg border border-white/[0.1] bg-white/[0.04] p-1.5 text-neutral-400 hover:text-neutral-200 hover:border-white/[0.2] hover:bg-white/[0.08] active:bg-white/[0.1] transition-colors duration-200 ease-out disabled:opacity-40"
              >
                <Search size={15} />
              </button>
            </div>
            {mode === "preview" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLE_BUTTONS.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    disabled={searching || !registryReady}
                    onClick={() => handleExample(ex.query)}
                    className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-neutral-400 hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-neutral-200 disabled:opacity-40 transition-colors duration-200 ease-out"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            )}
            {searchError && (
              <p className="mt-1.5 text-[10px] text-rose-400">
                {searchError}
              </p>
            )}
          </div>

          {/* 预览底部信息条 */}
          {mode === "preview" && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
              <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-[10px] text-neutral-500 whitespace-nowrap">
                {graphStats.totalNodes} 家企业 ·{" "}
                {graphStats.totalEdges.toLocaleString()} 条交易 · 5 大星团
              </span>
            </div>
          )}

          {/* 缩放控件 — 右下角 */}
          <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => {
                const { w, h } = sizeRef.current;
                zoomAt(w / 2, h / 2, 1.15);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.03] text-neutral-400 hover:text-neutral-200 hover:border-white/[0.2] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors duration-200 ease-out"
              aria-label="放大"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                const { w, h } = sizeRef.current;
                zoomAt(w / 2, h / 2, 0.87);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.03] text-neutral-400 hover:text-neutral-200 hover:border-white/[0.2] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors duration-200 ease-out"
              aria-label="缩小"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.03] text-neutral-400 hover:text-neutral-200 hover:border-white/[0.2] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors duration-200 ease-out"
              aria-label="重置"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* 图例 — 左下角 */}
          {mode === "graph" && (
            <div className="absolute bottom-3 left-3 z-10">
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[10px] text-neutral-500 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                  中心企业
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: RISK_CHART_COLORS["低风险"],
                    }}
                  />
                  卖方 / 买方（色阶对应风险）
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 右栏 25%：统计 + 图例 + 企业快照 ── */}
        <div className="w-72 shrink-0 space-y-3 hidden lg:flex lg:flex-col overflow-y-auto">
          {/* 图谱统计 */}
          <Card className="rounded-lg">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-neutral-500" />
                <span className="text-xs font-medium text-neutral-400 tracking-wide">
                  图谱统计
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500">
                    关联企业
                  </span>
                  <span className="text-sm font-mono tabular-nums text-neutral-200">
                    {graphStats.totalNodes}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500">
                    交易关系
                  </span>
                  <span className="text-sm font-mono tabular-nums text-neutral-200">
                    {graphStats.totalEdges.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-500">
                    高风险关联
                  </span>
                  <span
                    className="text-sm font-mono tabular-nums"
                    style={{ color: RISK_CHART_COLORS["高风险"] }}
                  >
                    {graphStats.highRiskLinks}
                  </span>
                </div>
              </div>
            </CardContent>
      </Card>

          {/* 图例说明 */}
          <Card className="rounded-lg">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-neutral-500" />
                <span className="text-xs font-medium text-neutral-400 tracking-wide">
                  图例
                </span>
            </div>

              {/* 风险等级色块 */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-neutral-600">
                  企业风险等级
                </span>
                <div className="space-y-1">
                  {(["高风险", "中高风险", "中等风险", "中低风险", "低风险"] as const).map(
                    (level) => (
                      <div
                        key={level}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            background: RISK_CHART_COLORS[level],
                          }}
                        />
                        <span className="text-[10px] text-neutral-500">
                          {level}
                        </span>
          </div>
                    ),
                  )}
          </div>
              </div>

              {/* 交易规模 */}
              <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                <span className="text-[10px] text-neutral-600">
                  交易规模（连线粗细）
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-px bg-white/20" />
                    <span className="text-[10px] text-neutral-500">小额</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-white/50" />
                    <span className="text-[10px] text-neutral-500">中额</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 bg-white/70" />
                    <span className="text-[10px] text-neutral-500">大额</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 选中企业快照 */}
          {centerNode && (
            <Card className="rounded-lg">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-neutral-100 leading-snug line-clamp-2">
                      {centerNode.name}
                    </h3>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      {centerNode.industry} · {centerNode.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <span
                    className="text-2xl font-bold font-mono tabular-nums leading-none"
                    style={{
                      color:
                        RISK_CHART_COLORS[centerNode.risk] ??
                        RISK_CHART_COLORS["中等风险"],
                    }}
                  >
                    {centerNode.score.toFixed(0)}
                  </span>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      RISK_LEVEL_COLORS[centerNode.risk] ??
                        RISK_LEVEL_COLORS["中等风险"],
                    )}
                  >
                    {centerNode.risk}
                  </Badge>
                </div>

                <p className="text-[10px] text-neutral-500">
                  关联 {centerNode.relatedCount} 家 · 交易量{" "}
                  {formatAmount(centerNode.volume)}
                </p>

                {/* 核心经营指标 */}
                <div className="space-y-1 pt-2 border-t border-white/[0.04]">
                  {(["tax_health", "authenticity", "finance"] as const).map(
                    (k) => {
                      const ent = registryRef.current.get(centerNode.id);
                      const score = ent?.dimensions?.[k];
                      return (
                        <div
                          key={k}
                          className="flex justify-between text-[10px]"
                        >
                          <span className="text-neutral-500">
                            {DIMENSION_LABELS[k]}
                          </span>
                          <span className="font-mono text-neutral-300">
                            {score != null ? score.toFixed(0) : "—"}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() =>
                      navigate(`/enterprise/${centerNode.id}`)
                    }
                  >
                    完整评估
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-white/[0.1] hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors duration-200 ease-out"
                    onClick={() => {
                      if (centerNode) showSubGraph(centerNode.id);
                    }}
                  >
                    重聚焦
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 关联交易列表 */}
          {centerNode && relatedTop5.length > 0 && (
            <Card className="rounded-lg">
              <CardContent className="pt-4 space-y-2">
                <span className="text-xs font-medium text-neutral-400 tracking-wide">
                  主要关联
                </span>
                {relatedTop5.map((rel) => (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => showSubGraph(rel.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors duration-200",
                      hoverId === rel.id || centerId === rel.id
                        ? "border-white/[0.2] bg-white/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]",
                    )}
                  >
                    <p className="text-xs text-neutral-200 truncate">
                      {rel.name}
                    </p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded border",
                          rel.role === "seller"
                            ? "text-teal-400 border-teal-500/25 bg-teal-500/10"
                            : "text-rose-400 border-rose-500/25 bg-rose-500/10",
                        )}
                      >
                        {roleLabel(rel.role)}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono tabular-nums">
                        {formatAmount(rel.amount)}
                      </span>
                    </div>
          </button>
                ))}
              </CardContent>
        </Card>
      )}
        </div>
      </div>

      {/* ═══ 底部统计卡片 ═══ */}
      <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Link2 size={15} className="text-blue-400" />
              </span>
              <span className="text-[10px] text-neutral-500">总交易关系</span>
            </div>
            <p className="text-[28px] font-bold font-mono tabular-nums text-neutral-100 leading-none">
              {graphStats.totalEdges.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] text-neutral-600">
                {graphStats.totalEdges > 0 ? "发票交易边" : "模拟数据"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Building2 size={15} className="text-indigo-400" />
              </span>
              <span className="text-[10px] text-neutral-500">关联企业</span>
            </div>
            <p className="text-[28px] font-bold font-mono tabular-nums text-neutral-100 leading-none">
              {graphStats.totalNodes}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] text-neutral-600">
                {typeof graphStats.totalNodes === "string" ? graphStats.totalNodes : "关联节点"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle size={15} className="text-rose-400" />
              </span>
              <span className="text-[10px] text-neutral-500">高风险关联</span>
            </div>
            <p
              className="text-[28px] font-bold font-mono tabular-nums leading-none"
              style={{ color: RISK_CHART_COLORS["高风险"] }}
            >
              {graphStats.highRiskLinks}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] text-neutral-600">
                {graphStats.highRiskLinks > 0 ? "需关注企业" : "无高风险关联"}
              </span>
              <span className="text-[10px] text-neutral-600 ml-1">环比</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
