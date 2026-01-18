"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, required, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(7)}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
          >
            {label}
            {required && <span className="text-error-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-xl border bg-white px-4 py-3 text-base text-neutral-900 placeholder-neutral-400",
            "transition-all duration-150",
            "hover:border-neutral-400",
            "focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
            "dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500",
            "dark:hover:border-neutral-600",
            "dark:focus:border-accent-500",
            "dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600",
            error
              ? "border-error-500 focus:border-error-500 focus:ring-error-500/20"
              : "border-neutral-300 dark:border-neutral-700",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm text-error-600 dark:text-error-400">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, required, ...props }, ref) => {
    const inputId = id || `textarea-${Math.random().toString(36).substring(7)}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
          >
            {label}
            {required && <span className="text-error-500 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-xl border bg-white px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 resize-none",
            "transition-all duration-150",
            "hover:border-neutral-400",
            "focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
            "dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500",
            "dark:hover:border-neutral-600",
            "dark:focus:border-accent-500",
            "dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600",
            error
              ? "border-error-500 focus:border-error-500 focus:ring-error-500/20"
              : "border-neutral-300 dark:border-neutral-700",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm text-error-600 dark:text-error-400">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
