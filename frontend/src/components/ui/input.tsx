import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 backdrop-blur-sm focus-visible:outline-none focus-visible:border-white/25 focus-visible:ring-1 focus-visible:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
