"use client";

import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
}: ModalProps) {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
        className={cn(
          "relative w-full rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900",
          "border border-neutral-200 dark:border-neutral-800",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          sizeStyles[size],
          className
        )}
      >
        {title && (
          <h2
            id="modal-title"
            className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1"
          >
            {title}
          </h2>
        )}
        {description && (
          <p
            id="modal-description"
            className="text-sm text-neutral-500 dark:text-neutral-400 mb-6"
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

// Modal footer for action buttons
interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn("flex gap-3 pt-2", className)}>
      {children}
    </div>
  );
}
