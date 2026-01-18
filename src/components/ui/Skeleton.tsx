"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseStyles =
    "animate-pulse bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-800 dark:via-neutral-700 dark:to-neutral-800 bg-[length:200%_100%]";

  const variantStyles = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const style: React.CSSProperties = {
    width: width || (variant === "text" ? "100%" : undefined),
    height: height || (variant === "text" ? undefined : "100%"),
  };

  if (lines > 1 && variant === "text") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseStyles, variantStyles[variant])}
            style={{
              ...style,
              width: i === lines - 1 ? "75%" : "100%",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], className)}
      style={style}
    />
  );
}

// Pre-built skeleton patterns for common use cases
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <Skeleton variant="rectangular" className="h-4 w-1/3 mb-4" />
      <Skeleton lines={3} className="mb-4" />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" className="h-8 w-20" />
        <Skeleton variant="rectangular" className="h-8 w-20" />
      </div>
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Skeleton variant="circular" className="h-10 w-10" />
      <div className="flex-1">
        <Skeleton className="h-4 w-1/3 mb-2" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonClinicalSummary() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-24" />
      </div>
      
      {/* HPI Section */}
      <div>
        <Skeleton className="h-4 w-20 mb-3" />
        <Skeleton lines={4} />
      </div>
      
      {/* PMH Section */}
      <div>
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton lines={2} />
      </div>
      
      {/* ROS Section */}
      <div>
        <Skeleton className="h-4 w-36 mb-3" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton lines={3} />
          <Skeleton lines={3} />
        </div>
      </div>
      
      {/* Follow-ups */}
      <div>
        <Skeleton className="h-4 w-40 mb-3" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
    </div>
  );
}
