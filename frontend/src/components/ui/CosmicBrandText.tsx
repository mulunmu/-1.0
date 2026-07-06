import { cn } from "@/lib/utils";

interface CosmicBrandTextProps {
  title: string;
  lead?: string;
  meta?: string;
  align?: "left" | "center";
  size?: "login" | "hub";
  className?: string;
}

/** 与土星粒子融合的标题排版 — 渐变 + screen 混合 + 柔光 */
export default function CosmicBrandText({
  title,
  lead,
  meta,
  align = "left",
  size = "login",
  className,
}: CosmicBrandTextProps) {
  return (
    <div
      className={cn(
        "cosmic-brand-block pointer-events-none select-none",
        align === "center" && "text-center items-center",
        align === "left" && "text-left items-start",
        size === "hub" && "cosmic-brand-block--hub",
        className,
      )}
    >
      <h1
        className={cn(
          "cosmic-brand-title",
          size === "login" && "text-3xl sm:text-4xl lg:text-[2.85rem]",
          size === "hub" && "text-lg sm:text-xl font-medium tracking-wide",
        )}
      >
        {title}
      </h1>
      {lead && (
        <p className={cn("cosmic-brand-lead", size === "login" ? "mt-4 text-sm" : "mt-2 text-xs")}>
          {lead}
        </p>
      )}
      {meta && (
        <p className={cn("cosmic-brand-meta", size === "login" ? "mt-2 text-xs" : "mt-1 text-[10px]")}>
          {meta}
        </p>
      )}
    </div>
  );
}
