"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input, SolaceLogo } from "@/components/ui";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const error = searchParams.get("error");

  const { signInWithEmail } = useSupabaseAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    error === "auth_callback_error" ? "Authentication failed. Please try again." : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsLoading(true);

    try {
      const { error } = await signInWithEmail(email, password);

      if (error) {
        setFormError(error.message || "Invalid email or password");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setFormError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center mb-6">
            <SolaceLogo className="h-10 w-10" />
            <span className="ml-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Solace
            </span>
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Welcome back
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Sign in to your clinic dashboard
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="p-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                <p className="text-sm text-error-600 dark:text-error-400">{formError}</p>
              </div>
            )}

            <Input
              type="email"
              label="Email"
              placeholder="you@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Account Notice */}
        <div className="mt-6 p-4 rounded-xl bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800">
          <p className="text-sm text-accent-700 dark:text-accent-300 text-center">
            <strong>Demo Account:</strong> demo@solace.health / demo123
          </p>
        </div>
      </div>
    </div>
  );
}
