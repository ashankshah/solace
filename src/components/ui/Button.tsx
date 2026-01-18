"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    "bg-accent-500 text-white shadow-sm",
    "hover:bg-accent-600 hover:shadow-md",
    "active:bg-accent-700",
    "disabled:bg-neutral-100 disabled:text-neutral-400 disabled:shadow-none",
    "dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600",
  ].join(" "),
  secondary: [
    "bg-neutral-900 text-white",
    "hover:bg-neutral-800",
    "active:bg-neutral-700",
    "dark:bg-neutral-100 dark:text-neutral-900",
    "dark:hover:bg-neutral-200",
    "dark:active:bg-neutral-300",
    "disabled:bg-neutral-100 disabled:text-neutral-400",
    "dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600",
  ].join(" "),
  ghost: [
    "bg-transparent text-neutral-700 border border-neutral-300",
    "hover:bg-neutral-50 hover:border-neutral-400",
    "active:bg-neutral-100",
    "dark:text-neutral-300 dark:border-neutral-600",
    "dark:hover:bg-neutral-800 dark:hover:border-neutral-500",
    "dark:active:bg-neutral-700",
    "disabled:text-neutral-400 disabled:border-neutral-200",
    "dark:disabled:text-neutral-600 dark:disabled:border-neutral-700",
  ].join(" "),
  danger: [
    "bg-error-500 text-white",
    "hover:bg-error-600",
    "active:bg-error-700",
    "disabled:bg-neutral-100 disabled:text-neutral-400",
    "dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600",
  ].join(" "),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
