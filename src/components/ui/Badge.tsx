"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "pending" | "reviewed" | "archived" | "success" | "warning" | "error" | "info";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  secondary: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  pending: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  reviewed: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  archived: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  success: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  warning: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  error: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500",
  info: "bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-500",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({ children, variant = "default", size = "md", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// Status-specific badge helpers
export function StatusBadge({ status }: { status: string }) {
  const variant = status as BadgeVariant;
  const validVariants: BadgeVariant[] = ["pending", "reviewed", "archived"];
  const statusLabel: Record<string, string> = {
    pending: "Queue",
    reviewed: "Active",
    archived: "Discharged",
  };
  
  return (
    <Badge variant={validVariants.includes(variant) ? variant : "default"}>
      {statusLabel[status] ?? status}
    </Badge>
  );
}
