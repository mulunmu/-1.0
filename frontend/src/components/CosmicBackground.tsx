import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** 与外围 UI 一致的深灰底色，避免中心纯黑、边缘发灰的割裂感 */
const BASE = "#161616";

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  s: number;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** 网格 + 抖动，保证中心与边缘星点密度一致 */
function initStars(w: number, h: number): Star[] {
  const cols = Math.ceil(Math.sqrt((w * h) / 4200));
  const rows = Math.ceil((h / w) * cols) || 1;
  const cellW = w / cols;
  const cellH = h / rows;
  const stars: Star[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      stars.push({
        x: (col + 0.15 + Math.random() * 0.7) * cellW,
        y: (row + 0.15 + Math.random() * 0.7) * cellH,
        r: Math.random() * 1.1 + 0.25,
        o: Math.random() * 6,
        s: Math.random() * 0.004 + 0.002,
      });
    }
  }
  return stars;
}

function initNodes(w: number, h: number): Node[] {
  const nodes: Node[] = [];
  for (let i = 0; i < 32; i++) {
    nodes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
    });
  }
  return nodes;
}

interface CosmicBackgroundProps {
  className?: string;
}

export default function CosmicBackground({ className }: CosmicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    let nodes: Node[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = parent?.clientHeight ?? window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      stars = initStars(w, h);
      nodes = initNodes(w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const meteors: Meteor[] = [];
    const spawnMeteor = () => {
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.15;
      const speed = Math.random() * 8 + 6;
      meteors.push({
        x: Math.random() * canvas.width * 0.8,
        y: Math.random() * canvas.height * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: Math.random() * 100 + 60,
        life: 1,
      });
    };

    let frame = 0;
    let meteorTimer = 0;

    const animate = () => {
      frame = requestAnimationFrame(animate);

      ctx.fillStyle = BASE;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach((s) => {
        s.o += s.s;
        const alpha = Math.sin(s.o) * 0.2 + 0.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.75})`;
        ctx.fill();
      });

      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });

      nodes.forEach((a, i) => {
        nodes.slice(i + 1).forEach((b) => {
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 220) {
            const alpha = (1 - dist / 220) * 0.1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
      });

      meteorTimer++;
      if (meteorTimer > 90 && meteors.length < 4) {
        spawnMeteor();
        meteorTimer = 0;
      }
      if (Math.random() < 0.003 && meteors.length < 5) spawnMeteor();

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life -= 0.008;

        const tailX = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len;
        const tailY = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len;

        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.7, `rgba(255,255,255,${0.12 * m.life})`);
        grad.addColorStop(1, `rgba(255,255,255,${0.85 * m.life})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * m.life})`;
        ctx.fill();

        if (m.life <= 0 || m.x > canvas.width + 100 || m.y > canvas.height + 100) {
          meteors.splice(i, 1);
        }
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 z-0 pointer-events-none", className)}
      aria-hidden
    />
  );
}
