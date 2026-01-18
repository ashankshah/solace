"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, SolaceLogo } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validate password match
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      // Create account
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to create account");
        setIsLoading(false);
        return;
      }

      // Auto sign in after successful signup
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Account created but sign in failed - redirect to login
        router.push("/login?message=Account created successfully. Please sign in.");
        return;
      }

      // Redirect to setup page for new users to configure their layout
      router.push("/setup");
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
            <SolaceLogo size="lg" />
            <span className="ml-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Solace
            </span>
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Create your account
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Set up your clinic dashboard in minutes
          </p>
        </div>

        {/* Signup Form */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="p-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                <p className="text-sm text-error-600 dark:text-error-400">{formError}</p>
              </div>
            )}

            <Input
              type="text"
              label="Clinic Name"
              placeholder="Downtown Medical Clinic"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="organization"
              hint="This will be your account name"
            />

            <Input
              type="email"
              label="Email"
              placeholder="admin@clinic.com"
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
              autoComplete="new-password"
              hint="At least 6 characters"
            />

            <Input
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-3">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">Multiple Clinics</p>
          </div>
          <div className="p-3">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">AI Intake</p>
          </div>
          <div className="p-3">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-600 dark:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">Secure Data</p>
          </div>
        </div>
      </div>
    </div>
  );
}
