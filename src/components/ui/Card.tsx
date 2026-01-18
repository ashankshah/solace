"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, interactive = false, selected = false, padding = "md", children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border bg-white shadow-sm dark:bg-neutral-900",
          interactive && [
            "transition-all duration-150 cursor-pointer",
            "hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600",
          ],
          selected
            ? "border-accent-500 ring-2 ring-accent-500/20 dark:border-accent-500"
            : "border-neutral-200 dark:border-neutral-800",
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "px-5 py-4 border-b border-neutral-100 dark:border-neutral-800",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = "CardHeader";

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn(
          "text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wider uppercase",
          className
        )}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = "CardTitle";

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("p-5", className)} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = "CardContent";

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "px-5 py-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-3",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = "CardFooter";
