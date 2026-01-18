"use client";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const sizeStyles = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-2",
};

export function Spinner({ size = "md", className, label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          "animate-spin rounded-full border-neutral-200 border-t-accent-500 dark:border-neutral-700 dark:border-t-accent-500",
          sizeStyles[size],
          className
        )}
        role="status"
        aria-label={label || "Loading"}
      />
      {label && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      )}
    </div>
  );
}

// Full page loading state
export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}
