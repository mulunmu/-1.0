import { useEffect, useRef } from "react";

/** 登录页深空远景视差 — 远星场慢移 + 近处大星座快移 */

interface FarStar {
  x: number;
  y: number;
  r: number;
  phase: number;
}

interface NearNode {
  x: number;
  y: number;
  phase: number;
}

function initFarStars(w: number, h: number, count: number): FarStar[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 0.7 + 0.2,
    phase: Math.random() * Math.PI * 2,
  }));
}

function initNearNodes(w: number, h: number): NearNode[] {
  const nodes: NearNode[] = [];
  const cols = 4;
  const rows = 3;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      nodes.push({
        x: (col + 0.2 + Math.random() * 0.6) * (w / cols),
        y: (row + 0.2 + Math.random() * 0.6) * (h / rows),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  return nodes;
}

export default function LoginDeepSpace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const farRef = useRef<FarStar[]>([]);
  const midRef = useRef<FarStar[]>([]);
  const nearRef = useRef<NearNode[]>([]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;
      mouseRef.current = {
        x: (e.clientX / w - 0.5) * 2,
        y: (e.clientY / h - 0.5) * 2,
      };
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h };
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      farRef.current = initFarStars(w, h, Math.floor((w * h) / 9000));
      midRef.current = initFarStars(w, h, Math.floor((w * h) / 4500));
      nearRef.current = initNearNodes(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;

      const t = now * 0.001;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const dpr = devicePixelRatio;

      const farOx = Math.sin(t * 0.12) * 18 + mx * 6;
      const farOy = Math.cos(t * 0.1) * 14 + my * 5;
      const midOx = Math.sin(t * 0.22) * 32 + mx * 14;
      const midOy = Math.cos(t * 0.18) * 26 + my * 12;
      const nearOx = Math.sin(t * 0.38) * 55 + mx * 28;
      const nearOy = Math.cos(t * 0.32) * 42 + my * 22;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const wrap = (v: number, max: number) => ((v % max) + max) % max;

      farRef.current.forEach((s) => {
        const alpha = 0.12 + Math.sin(t * 0.8 + s.phase) * 0.08;
        ctx.beginPath();
        ctx.arc(wrap(s.x + farOx, w), wrap(s.y + farOy, h), s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });

      midRef.current.forEach((s) => {
        const alpha = 0.2 + Math.sin(t * 1.1 + s.phase) * 0.12;
        ctx.beginPath();
        ctx.arc(wrap(s.x + midOx, w), wrap(s.y + midOy, h), s.r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });

      const nodes = nearRef.current;
      const linkDist = Math.min(w, h) * 0.22;

      nodes.forEach((a, i) => {
        nodes.slice(i + 1).forEach((b) => {
          const ax = wrap(a.x + nearOx, w);
          const ay = wrap(a.y + nearOy, h);
          const bx = wrap(b.x + nearOx, w);
          const by = wrap(b.y + nearOy, h);
          const dx = ax - bx;
          const dy = ay - by;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * 0.14;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        });
      });

      nodes.forEach((n) => {
        const alpha = 0.35 + Math.sin(t * 1.6 + n.phase) * 0.18;
        const x = wrap(n.x + nearOx, w);
        const y = wrap(n.y + nearOy, h);
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.08})`;
        ctx.fill();
      });
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[1] pointer-events-none"
      aria-hidden
    />
  );
}
