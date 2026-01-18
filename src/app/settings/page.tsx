"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useRouter } from "next/navigation";
import { LayoutBuilder } from "@/components/LayoutBuilder";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageLoader,
  Header,
  HeaderBranding,
  ChevronLeftIcon,
} from "@/components/ui";
import { createEmptyLayout } from "@/types/layout";
import type { ClinicLayout } from "@/types/layout";

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const [layout, setLayout] = useState<ClinicLayout>(createEmptyLayout());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Fetch the current layout
  useEffect(() => {
    if (!authLoading && user) {
      fetchLayout();
    }
  }, [authLoading, user]);

  const fetchLayout = async () => {
    try {
      const res = await fetch("/api/layout");
      if (res.ok) {
        const data = await res.json();
        setLayout({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
      }
    } catch (error) {
      console.error("Failed to fetch layout:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async (nextLayout?: ClinicLayout, options?: { silent?: boolean }) => {
    const layoutToSave = nextLayout ?? layout;
    setSaving(true);
    if (!options?.silent) {
      setSaveMessage(null);
    }

    try {
      const res = await fetch("/api/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layoutToSave),
      });

      if (res.ok) {
        const data = await res.json();
        setLayout({
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        });
        if (!options?.silent) {
          setSaveMessage({ type: 'success', text: 'Layout saved successfully!' });
          setTimeout(() => setSaveMessage(null), 3000);
        }
      } else {
        const error = await res.json();
        setSaveMessage({ type: 'error', text: error.error || 'Failed to save layout' });
      }
    } catch (error) {
      console.error("Failed to save layout:", error);
      setSaveMessage({ type: 'error', text: 'Failed to save layout' });
    } finally {
      setSaving(false);
    }
  }, [layout]);

  if (authLoading || loading) {
    return <PageLoader label="Loading settings..." />;
  }

  if (!user) {
    return <PageLoader label="Redirecting to login..." />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header>
        <HeaderBranding subtitle="Account Settings" />
        <Button variant="ghost" onClick={() => router.push("/dashboard")} leftIcon={<ChevronLeftIcon />}>
          Back to Dashboard
        </Button>
      </Header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Account Info Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Name
                </label>
                <p className="text-neutral-900 dark:text-neutral-100">
                  {user?.user_metadata?.name || user?.email?.split('@')[0] || "—"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Email
                </label>
                <p className="text-neutral-900 dark:text-neutral-100">
                  {user?.email || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Layout Builder Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Clinic Layout Editor</CardTitle>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Configure your clinic rooms and layout. This will be displayed on your dashboard.
                </p>
              </div>
              {saveMessage && (
                <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  saveMessage.type === 'success'
                    ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400'
                    : 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400'
                }`}>
                  {saveMessage.text}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <LayoutBuilder
              layout={layout}
              onChange={setLayout}
              onSave={handleSave}
              isSaving={saving}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
