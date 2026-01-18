"use client";

import { useState, useEffect, use } from "react";
import DynamicQuiz from "@/components/DynamicQuiz";
import type { AnswerRecord, Question } from "@/types/intake";
import type { Clinic } from "@/types/clinic";
import { 
  Button, 
  Input, 
  Card, 
  PageLoader, 
  Spinner, 
  Header, 
  HeaderBranding, 
  SolaceLogo,
  SuccessCheckIcon,
  ErrorCircleIcon,
} from "@/components/ui";

interface CheckinPageProps {
  params: Promise<{ clinicId: string }>;
}

type PageState = "loading" | "info" | "quiz" | "submitting" | "completed" | "error";

// Next steps component
function NextSteps({ steps }: { steps: string[] }) {
  return (
    <Card className="text-left">
      <h2 className="mb-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wider uppercase">
        What happens next
      </h2>
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700 dark:bg-accent-500/20 dark:text-accent-400">
              {index + 1}
            </span>
            <span className="text-sm text-neutral-600 dark:text-neutral-300 pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

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
    return <PageLoader label="Loading..." />;
  }

  // Error state
  if (state === "error") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <ErrorCircleIcon />
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3 tracking-tight">
            Something went wrong
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Completed state
  if (state === "completed") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <SuccessCheckIcon />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3 tracking-tight">
            Thank you, {patientName}!
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
            Your check-in for <span className="font-medium text-neutral-700 dark:text-neutral-300">{clinic?.name}</span> has been submitted successfully.
          </p>
          
          <NextSteps
            steps={[
              "Our team is reviewing your responses",
              "A clinical summary is being prepared",
              "You'll be called when we're ready for you",
            ]}
          />
        </div>
      </div>
    );
  }

  // Submitting state
  if (state === "submitting") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <Spinner size="lg" label="Submitting your responses..." />
      </div>
    );
  }

  // Info collection state
  if (state === "info") {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        {/* Header */}
        <Header maxWidth="3xl">
          <div className="flex items-center gap-3">
            <SolaceLogo />
            <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Solace Ask</span>
          </div>
        </Header>

        {/* Content */}
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-accent-600 dark:text-accent-400 mb-3 tracking-wider uppercase">
              Welcome, I&apos;m Solace Ask
            </p>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {clinic?.name}
            </h1>
            {clinic?.address && (
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{clinic.address}</p>
            )}
          </div>

          <form onSubmit={handleStartQuiz} className="space-y-6">
            <Input
              id="name"
              label="Your Name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Enter your full name"
              required
            />

            <Input
              type="email"
              id="email"
              label="Email Address"
              hint="Optional"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="your@email.com"
            />

            <Button
              type="submit"
              disabled={!patientName.trim()}
              className="w-full"
              size="lg"
            >
              Start Check-In
            </Button>
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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header maxWidth="3xl">
        <HeaderBranding subtitle={clinic?.name} />
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success-500"></div>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {patientName}
          </span>
        </div>
      </Header>

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
