import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type LineSigilMode = "idle" | "thinking";

interface LineSigilProps {
  mode?: LineSigilMode;
  size?: number;
  className?: string;
}

/** 线条构成的微型星座图形 — idle 慢速呼吸，thinking 加速脉动 */
export default function LineSigil({ mode = "idle", size = 40, className }: LineSigilProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += mode === "thinking" ? 0.055 : 0.014;
      const rot = svgRef.current?.querySelector(".sigil-rot");
      if (rot) rot.setAttribute("transform", `rotate(${(t * 18) % 360} 20 20)`);

      svgRef.current?.querySelectorAll<SVGLineElement>(".sigil-line").forEach((line, i) => {
        const base = mode === "thinking" ? 0.55 : 0.28;
        const amp = mode === "thinking" ? 0.35 : 0.12;
        const speed = mode === "thinking" ? 4.5 : 1.2;
        line.setAttribute("stroke-opacity", String(base + Math.sin(t * speed + i * 0.7) * amp));
      });

      svgRef.current?.querySelectorAll<SVGCircleElement>(".sigil-node").forEach((c, i) => {
        const pulse = mode === "thinking"
          ? 0.65 + Math.sin(t * 5 + i) * 0.35
          : 0.45 + Math.sin(t * 1.5 + i * 0.8) * 0.2;
        c.setAttribute("fill-opacity", String(pulse));
        if (mode === "thinking") {
          c.setAttribute("r", String(1.1 + Math.sin(t * 6 + i) * 0.35));
        } else {
          c.setAttribute("r", "0.85");
        }
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const r = 13;
  const nodes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: 20 + Math.cos(a) * r, y: 20 + Math.sin(a) * r };
  });

  const links: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
    [0, 3], [1, 4], [2, 5],
  ];

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <g className="sigil-rot">
        {links.map(([a, b], i) => (
          <line
            key={i}
            className="sigil-line"
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke={mode === "thinking" ? "#22d3ee" : "rgba(255,255,255,0.85)"}
            strokeWidth={mode === "thinking" ? 0.75 : 0.55}
            strokeOpacity="0.3"
          />
        ))}
        {nodes.map((n, i) => (
          <circle
            key={i}
            className="sigil-node"
            cx={n.x}
            cy={n.y}
            r={0.85}
            fill={mode === "thinking" ? "#22d3ee" : "white"}
            fillOpacity="0.5"
          />
        ))}
      </g>
    </svg>
  );
}
