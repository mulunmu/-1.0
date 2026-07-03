import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import LineSigil from "@/components/LineSigil";

interface SidebarNavIconProps {
  icon: LucideIcon;
  active: boolean;
  label: string;
}

/** 侧边栏菜单图标 — 选中时线条星座在背后旋转互动 */
export default function SidebarNavIcon({ icon: Icon, active, label }: SidebarNavIconProps) {
  return (
    <span
      className={cn(
        "relative flex items-center justify-center w-5 h-5 shrink-0 transition-transform duration-300",
        active && "scale-110",
      )}
      aria-hidden
    >
      {active && (
        <LineSigil
          mode="idle"
          size={26}
          className="absolute inset-0 m-auto opacity-90 pointer-events-none"
        />
      )}
      <Icon
        size={17}
        className={cn(
          "relative z-10 transition-colors duration-300",
          active ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]" : "text-current",
        )}
        strokeWidth={active ? 2.2 : 1.75}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
