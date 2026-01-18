"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LayoutBuilder } from "@/components/LayoutBuilder";
import {
  Button,
  PageLoader,
  SolaceLogo,
} from "@/components/ui";
import { createEmptyLayout } from "@/types/layout";
import type { ClinicLayout } from "@/types/layout";

export default function SetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [layout, setLayout] = useState<ClinicLayout>(createEmptyLayout());
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      const res = await fetch("/api/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });

      if (res.ok) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to save layout:", error);
    } finally {
      setSaving(false);
    }
  }, [layout, router]);

  const handleSkip = () => {
    router.push("/dashboard");
  };

  if (status === "loading") {
    return <PageLoader label="Loading..." />;
  }

  if (status === "unauthenticated") {
    return <PageLoader label="Redirecting to login..." />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <SolaceLogo />
            <div>
              <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Solace
              </span>
              <span className="text-neutral-300 dark:text-neutral-600 mx-2">/</span>
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Setup
              </span>
            </div>
          </div>
          <Button variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Progress Indicator */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${currentStep >= 1 ? "text-accent-600" : "text-neutral-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                currentStep >= 1 
                  ? "bg-accent-500 text-white" 
                  : "bg-neutral-200 dark:bg-neutral-700"
              }`}>
                1
              </div>
              <span className="text-sm font-medium hidden sm:inline">Account Created</span>
            </div>
            <div className="w-12 h-0.5 bg-neutral-200 dark:bg-neutral-700" />
            <div className={`flex items-center gap-2 ${currentStep >= 2 ? "text-accent-600" : "text-neutral-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                currentStep >= 2 
                  ? "bg-accent-500 text-white" 
                  : "bg-neutral-200 dark:bg-neutral-700"
              }`}>
                2
              </div>
              <span className="text-sm font-medium hidden sm:inline">Configure Layout</span>
            </div>
            <div className="w-12 h-0.5 bg-neutral-200 dark:bg-neutral-700" />
            <div className={`flex items-center gap-2 ${currentStep >= 3 ? "text-accent-600" : "text-neutral-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                currentStep >= 3 
                  ? "bg-accent-500 text-white" 
                  : "bg-neutral-200 dark:bg-neutral-700"
              }`}>
                3
              </div>
              <span className="text-sm font-medium hidden sm:inline">Ready!</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <div className="text-center max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-success-600 dark:text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              Welcome to Solace, {session?.user?.name}!
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8">
              Your account has been created. Let&apos;s set up your clinic layout to visualize 
              your rooms and manage patient flow efficiently.
            </p>
            <Button onClick={() => setCurrentStep(2)} size="lg">
              Configure Clinic Layout
            </Button>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
                Design Your Clinic Layout
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 max-w-lg mx-auto">
                Drag waiting rooms and patient rooms onto the grid. You can resize and reposition them as needed.
                This layout will be displayed on your dashboard.
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 mb-8">
              <LayoutBuilder
                layout={layout}
                onChange={setLayout}
              />
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button 
                onClick={() => {
                  setCurrentStep(3);
                  handleSave();
                }} 
                size="lg"
                isLoading={saving}
              >
                {layout.rooms.length > 0 ? "Save & Continue" : "Skip Layout Setup"}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="text-center max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              You&apos;re All Set!
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8">
              Your clinic is ready to go. You can now start adding clinics, 
              sharing check-in links with patients, and viewing submissions.
            </p>
            <Button onClick={() => router.push("/dashboard")} size="lg">
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
