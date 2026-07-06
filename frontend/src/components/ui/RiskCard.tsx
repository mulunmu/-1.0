import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 全站唯一卡片容器 — 方案 C 红线规范
 * 8px 圆角 · p-5 内边距 · --border-subtle 单色边框 · 无渐变/发光/玻璃
 */

const RiskCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-[var(--border-subtle)] bg-[var(--color-bg-surface)] p-5",
      className,
    )}
    {...props}
  />
));
RiskCard.displayName = "RiskCard";

const RiskCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
));
RiskCardHeader.displayName = "RiskCardHeader";

const RiskCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-sm font-semibold leading-none tracking-tight text-neutral-200",
      className,
    )}
    {...props}
  />
));
RiskCardTitle.displayName = "RiskCardTitle";

const RiskCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
RiskCardContent.displayName = "RiskCardContent";

export { RiskCard, RiskCardHeader, RiskCardTitle, RiskCardContent };
