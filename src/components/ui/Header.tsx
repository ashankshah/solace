"use client";

import { cn } from "@/lib/utils";

interface HeaderProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "3xl" | "7xl";
}

const maxWidthStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "3xl": "max-w-3xl",
  "7xl": "max-w-7xl",
};

export function Header({ children, className, maxWidth = "7xl" }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-sm",
        "dark:border-neutral-800 dark:bg-neutral-950/80",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between px-6 py-4",
          maxWidthStyles[maxWidth]
        )}
      >
        {children}
      </div>
    </header>
  );
}

// Solace branding logo
interface SolaceLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const logoSizes = {
  sm: { container: "h-8 w-8", icon: "h-4 w-4" },
  md: { container: "h-9 w-9", icon: "h-5 w-5" },
  lg: { container: "h-10 w-10", icon: "h-6 w-6" },
};

export function SolaceLogo({ className, size = "md" }: SolaceLogoProps) {
  const sizeStyles = logoSizes[size];
  return (
    <div className={cn(
      "flex items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 shadow-sm",
      sizeStyles.container,
      className
    )}>
      <svg
        className={cn("text-white", sizeStyles.icon)}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </div>
  );
}

// Header branding section with logo and title
interface HeaderBrandingProps {
  subtitle?: string;
}

export function HeaderBranding({ subtitle }: HeaderBrandingProps) {
  return (
    <div className="flex items-center gap-3">
      <SolaceLogo />
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Solace
        </span>
        {subtitle && (
          <>
            <span className="text-neutral-300 dark:text-neutral-600">/</span>
            <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
