"use client";

import { useState, useEffect, use } from "react";
import DynamicQuiz from "@/components/DynamicQuiz";
import type { AnswerRecord, Question } from "@/types/intake";
import type { Clinic } from "@/types/clinic";

interface CheckinPageProps {
  params: Promise<{ clinicId: string }>;
}

type PageState = "loading" | "info" | "quiz" | "submitting" | "completed" | "error";

export default function CheckinPage({ params }: CheckinPageProps) {
  const { clinicId } = use(params);
  const [state, setState] = useState<PageState>("loading");
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    async function fetchClinic() {
      try {
        const res = await fetch(`/api/clinics/${clinicId}`);
        if (!res.ok) {
          setError("Clinic not found. Please check your link and try again.");
          setState("error");
          return;
        }
        const data = await res.json();
        setClinic(data);
        setState("info");
      } catch {
        setError("Failed to load clinic information.");
        setState("error");
      }
    }
    fetchClinic();
  }, [clinicId]);

  const handleStartQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) return;
    setState("quiz");
  };

  const handleQuizComplete = async (answers: AnswerRecord) => {
    setState("submitting");

    try {
      const res = await fetch(`/api/clinics/${clinicId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patientName.trim(),
          patientEmail: patientEmail.trim() || undefined,
          questions,
          answers,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setState("completed");
    } catch {
      setError("Failed to submit your responses. Please try again.");
      setState("error");
    }
  };

  // Track questions as they're asked
  const handleQuestionAsked = (question: Question) => {
    setQuestions((prev) => {
      if (prev.find((q) => q.id === question.id)) return prev;
      return [...prev, question];
    });
  };

  // Loading state
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Something went wrong
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Completed state
  if (state === "completed") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100">
              <svg className="h-8 w-8 text-white dark:text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3 tracking-tight">
            Thank you, {patientName}!
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
            Your check-in for <span className="font-medium text-neutral-700 dark:text-neutral-300">{clinic?.name}</span> has been submitted successfully.
          </p>
          
          <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800 text-left">
            <h2 className="mb-4 text-sm font-medium text-neutral-900 dark:text-neutral-100 tracking-wide uppercase">
              What happens next
            </h2>
            <ol className="space-y-4">
              {[
                "Our team is reviewing your responses",
                "A clinical summary is being prepared",
                "You'll be called when we're ready for you",
              ].map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                    {index + 1}
                  </span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-300 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Submitting state
  if (state === "submitting") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Submitting your responses...</p>
        </div>
      </div>
    );
  }

  // Info collection state
  if (state === "info") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* Header */}
        <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100">
                <svg className="h-4 w-4 text-white dark:text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Solace</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2 tracking-wide uppercase">
              Check-in for
            </p>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {clinic?.name}
            </h1>
            {clinic?.address && (
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{clinic.address}</p>
            )}
          </div>

          <form onSubmit={handleStartQuiz} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter your full name"
                required
                className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:border-neutral-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Email Address <span className="text-neutral-400">(optional)</span>
              </label>
              <input
                type="email"
                id="email"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:border-neutral-500"
              />
            </div>

            <button
              type="submit"
              disabled={!patientName.trim()}
              className={`w-full rounded-lg py-3 text-sm font-medium transition-colors ${
                patientName.trim()
                  ? "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                  : "bg-neutral-100 text-neutral-400 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-600"
              }`}
            >
              Start Check-In
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
            Your information is kept secure and confidential.
          </p>
        </main>
      </div>
    );
  }

  // Quiz state
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100">
              <svg className="h-4 w-4 text-white dark:text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Solace</span>
              <span className="mx-2 text-neutral-300 dark:text-neutral-600">·</span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{clinic?.name}</span>
            </div>
          </div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {patientName}
          </div>
        </div>
      </header>

      {/* Quiz */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <DynamicQuiz 
          onComplete={handleQuizComplete} 
          onQuestionAsked={handleQuestionAsked}
        />
      </main>
    </div>
  );
}
