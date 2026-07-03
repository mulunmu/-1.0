import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** 登录页品牌标记 — 六边形雷达 + 星座连线 */
export default function LoginBrandMark({ size = 56, className }: { size?: number; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.012;
      const rot = svgRef.current?.querySelector(".brand-rot");
      if (rot) rot.setAttribute("transform", `rotate(${(t * 12) % 360} 32 32)`);

      svgRef.current?.querySelectorAll<SVGLineElement>(".brand-line").forEach((line, i) => {
        line.setAttribute("stroke-opacity", String(0.25 + Math.sin(t * 1.4 + i * 0.9) * 0.2));
      });

      svgRef.current?.querySelectorAll<SVGCircleElement>(".brand-node").forEach((c, i) => {
        c.setAttribute("fill-opacity", String(0.45 + Math.sin(t * 1.8 + i * 0.7) * 0.35));
      });

      const pulse = svgRef.current?.querySelector(".brand-core");
      if (pulse) pulse.setAttribute("r", String(2.2 + Math.sin(t * 2) * 0.4));

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: 32 + Math.cos(a) * 22, y: 32 + Math.sin(a) * 22 };
  });

  const inner = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: 32 + Math.cos(a) * 12, y: 32 + Math.sin(a) * 12 };
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
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <polygon
        points={hex.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.8"
      />
      <g className="brand-rot">
        {links.map(([a, b], i) => (
          <line
            key={i}
            className="brand-line"
            x1={inner[a].x}
            y1={inner[a].y}
            x2={inner[b].x}
            y2={inner[b].y}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.55"
            strokeOpacity="0.3"
          />
        ))}
        {inner.map((n, i) => (
          <circle key={i} className="brand-node" cx={n.x} cy={n.y} r="1" fill="white" fillOpacity="0.5" />
        ))}
      </g>
      <circle className="brand-core" cx="32" cy="32" r="2.2" fill="white" fillOpacity="0.9" />
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1="32"
            y1="32"
            x2={32 + Math.cos(rad) * 18}
            y2={32 + Math.sin(rad) * 18}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.4"
          />
        );
      })}
    </svg>
  );
}
