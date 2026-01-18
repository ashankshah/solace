"use client";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: {
    container: "p-6",
    iconWrapper: "w-10 h-10 mb-3",
    iconSize: "h-5 w-5",
    title: "text-sm font-medium",
    description: "text-xs mt-1",
  },
  md: {
    container: "p-8",
    iconWrapper: "w-12 h-12 mb-3",
    iconSize: "h-6 w-6",
    title: "text-sm font-medium",
    description: "text-xs mt-1",
  },
  lg: {
    container: "p-12",
    iconWrapper: "w-16 h-16 mb-4",
    iconSize: "h-8 w-8",
    title: "text-base font-medium",
    description: "text-sm mt-1",
  },
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const styles = sizeStyles[size];

  return (
    <div className={cn("text-center", styles.container, className)}>
      {icon && (
        <div
          className={cn(
            "mx-auto rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center",
            styles.iconWrapper
          )}
        >
          <div className={cn("text-neutral-400 dark:text-neutral-500", styles.iconSize)}>
            {icon}
          </div>
        </div>
      )}
      <p className={cn("text-neutral-600 dark:text-neutral-300", styles.title)}>
        {title}
      </p>
      {description && (
        <p className={cn("text-neutral-400 dark:text-neutral-500", styles.description)}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Common empty state icons
export function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}

export function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}

export function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
      />
    </svg>
  );
}
