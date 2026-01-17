"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Question, Answer, AnswerRecord } from "@/types/intake";
import { fetchNextQuestion, generateFallbackQuestions } from "@/lib/questions";

interface DynamicQuizProps {
  onComplete: (answers: AnswerRecord) => void;
  onQuestionAsked?: (question: Question) => void;
}

type QuizState = "loading" | "question" | "complete" | "error";

export default function DynamicQuiz({ onComplete, onQuestionAsked }: DynamicQuizProps) {
  const [state, setState] = useState<QuizState>("loading");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionHistory, setQuestionHistory] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord>({});
  const [currentAnswer, setCurrentAnswer] = useState<Answer | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [fallbackQuestions] = useState(() => generateFallbackQuestions());

  const loadNextQuestion = useCallback(async (currentAnswers: AnswerRecord, currentHistory: Question[]) => {
    setState("loading");

    // If using fallback mode, use static questions
    if (useFallback) {
      if (fallbackIndex >= fallbackQuestions.length) {
        setState("complete");
        onComplete(currentAnswers);
        return;
      }
      const nextQ = fallbackQuestions[fallbackIndex];
      setCurrentQuestion(nextQ);
      setQuestionHistory((prev) => [...prev, nextQ]);
      setFallbackIndex((prev) => prev + 1);
      setState("question");
      onQuestionAsked?.(nextQ);
      return;
    }

    // Use answer count as the question count (number of completed questions)
    const answeredCount = Object.keys(currentAnswers).length;
    
    // Fetch from AI - pass answered question count and history of answered questions only
    const result = await fetchNextQuestion(currentAnswers, answeredCount, currentHistory);

    if ("error" in result) {
      // If API fails, switch to fallback mode
      console.warn("API error, switching to fallback questions:", result.error);
      setError(result.error);
      setUseFallback(true);
      
      // Load first fallback question
      const firstQ = fallbackQuestions[0];
      setCurrentQuestion(firstQ);
      setQuestionHistory([firstQ]);
      setFallbackIndex(1);
      setState("question");
      onQuestionAsked?.(firstQ);
      return;
    }

    if ("complete" in result) {
      setState("complete");
      onComplete(currentAnswers);
      return;
    }

    setCurrentQuestion(result.question);
    setQuestionHistory((prev) => [...prev, result.question]);
    setState("question");
    onQuestionAsked?.(result.question);
  }, [useFallback, fallbackIndex, fallbackQuestions, onComplete, onQuestionAsked]);

  // Load first question on mount
  useEffect(() => {
    loadNextQuestion({}, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canProceed = (): boolean => {
    if (!currentQuestion) return false;
    if (!currentQuestion.required && !currentAnswer) return true;
    if (!currentAnswer) return false;
    if (currentAnswer.type === "short_answer") {
      return currentAnswer.value.trim().length > 0 || !currentQuestion.required;
    }
    return true;
  };

  const handleMultipleChoiceSelect = (optionIndex: number) => {
    if (!currentQuestion || currentQuestion.type !== "multiple_choice") return;
    setCurrentAnswer({
      questionId: currentQuestion.id,
      type: "multiple_choice",
      selectedIndex: optionIndex,
      selectedValue: currentQuestion.options[optionIndex],
    });
  };

  const handleShortAnswerChange = (value: string) => {
    if (!currentQuestion || currentQuestion.type !== "short_answer") return;
    setCurrentAnswer({
      questionId: currentQuestion.id,
      type: "short_answer",
      value,
    });
  };

  const handleSliderChange = (value: number) => {
    if (!currentQuestion || currentQuestion.type !== "slider") return;
    setCurrentAnswer({
      questionId: currentQuestion.id,
      type: "slider",
      value,
    });
  };

  const handleNext = async () => {
    if (!canProceed() || !currentQuestion) return;

    const newAnswers: AnswerRecord = { ...answers };
    if (currentAnswer) {
      newAnswers[currentQuestion.id] = currentAnswer;
    }
    setAnswers(newAnswers);

    // Build history of answered questions only (for API context)
    // Include current question since it's now answered
    const answeredHistory = questionHistory.filter(q => 
      newAnswers[q.id] !== undefined
    );
    // Make sure current question is included if just answered
    if (currentAnswer && !answeredHistory.find(q => q.id === currentQuestion.id)) {
      answeredHistory.push(currentQuestion);
    }

    setIsAnimating(true);
    setTimeout(async () => {
      setCurrentAnswer(null);
      setIsAnimating(false);
      await loadNextQuestion(newAnswers, answeredHistory);
    }, 200);
  };

  const handleBack = () => {
    const historyIndex = questionHistory.findIndex((q) => q.id === currentQuestion?.id);
    if (historyIndex <= 0) return;

    // Save current answer
    if (currentAnswer && currentQuestion) {
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: currentAnswer }));
    }

    setIsAnimating(true);
    setTimeout(() => {
      const prevQuestion = questionHistory[historyIndex - 1];
      setCurrentQuestion(prevQuestion);
      setCurrentAnswer(answers[prevQuestion.id] ?? null);
      setIsAnimating(false);
      setState("question");
    }, 200);
  };

  const handleSkip = async () => {
    if (!currentQuestion || currentQuestion.required) return;

    setIsAnimating(true);
    setTimeout(async () => {
      setCurrentAnswer(null);
      setIsAnimating(false);
      await loadNextQuestion(answers, questionHistory);
    }, 200);
  };

  const currentHistoryIndex = questionHistory.findIndex((q) => q.id === currentQuestion?.id);
  const MAX_QUESTIONS = 10;
  const progress = questionHistory.length > 0 
    ? ((currentHistoryIndex + 1) / MAX_QUESTIONS) * 100 
    : 0;

  // Pre-compute slider values to avoid IIFE in JSX
  const sliderValues = useMemo(() => {
    if (!currentQuestion || currentQuestion.type !== "slider") {
      return { min: 0, max: 10, step: 1, minLabel: undefined, maxLabel: undefined, unit: undefined };
    }
    return {
      min: 'min' in currentQuestion ? (currentQuestion.min ?? 0) : 0,
      max: 'max' in currentQuestion ? (currentQuestion.max ?? 10) : 10,
      step: 'step' in currentQuestion ? (currentQuestion.step ?? 1) : 1,
      minLabel: 'minLabel' in currentQuestion ? currentQuestion.minLabel : undefined,
      maxLabel: 'maxLabel' in currentQuestion ? currentQuestion.maxLabel : undefined,
      unit: 'unit' in currentQuestion ? currentQuestion.unit : undefined,
    };
  }, [currentQuestion]);

  const sliderCurrentValue = useMemo(() => {
    if (currentAnswer?.type === "slider") {
      return currentAnswer.value;
    }
    return sliderValues.min;
  }, [currentAnswer, sliderValues.min]);

  // Loading state
  if (state === "loading") {
    return (
      <div className="w-full max-w-xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {questionHistory.length === 0 ? "Preparing your intake..." : "Generating next question..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state with fallback active notification
  if (state === "error") {
    return (
      <div className="w-full max-w-xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  // Completed state is handled by parent
  if (state === "complete" || !currentQuestion) {
    return null;
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* API Status Banner */}
      {useFallback && error && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Using standard questions (AI unavailable)
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-10">
        <div className="mb-2 flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <span>Question {currentHistoryIndex + 1} of {MAX_QUESTIONS}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className="h-full rounded-full bg-neutral-900 dark:bg-neutral-100 transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div
        className={`transition-all duration-200 ease-out ${
          isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        {/* Question Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 tracking-wide uppercase">
              {currentQuestion.category ?? "Health Assessment"}
            </p>
            {!currentQuestion.required && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                (Optional)
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight">
            {currentQuestion.question}
          </h2>
        </div>

        {/* Multiple Choice Options */}
        {currentQuestion.type === "multiple_choice" && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected =
                currentAnswer?.type === "multiple_choice" &&
                currentAnswer.selectedIndex === index;
              return (
                <button
                  key={index}
                  onClick={() => handleMultipleChoiceSelect(index)}
                  className={`group w-full rounded-lg border p-4 text-left transition-all duration-150 ease-out ${
                    isSelected
                      ? "border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100"
                      : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-750"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
                        isSelected
                          ? "border-transparent bg-white dark:bg-neutral-900"
                          : "border-neutral-300 bg-transparent dark:border-neutral-600"
                      }`}
                    >
                      {isSelected ? (
                        <svg
                          className="h-3.5 w-3.5 text-neutral-900 dark:text-neutral-100"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                          {String.fromCharCode(65 + index)}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-base leading-snug ${
                        isSelected
                          ? "font-medium text-white dark:text-neutral-900"
                          : "text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      {option}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Short Answer Input */}
        {currentQuestion.type === "short_answer" && (
          <div className="space-y-2">
            <textarea
              value={
                currentAnswer?.type === "short_answer" ? currentAnswer.value : ""
              }
              onChange={(e) => handleShortAnswerChange(e.target.value)}
              placeholder={currentQuestion.placeholder}
              maxLength={currentQuestion.maxLength}
              rows={4}
              className="w-full rounded-lg border border-neutral-200 bg-white p-4 text-base text-neutral-900 placeholder-neutral-400 transition-colors duration-150 focus:border-neutral-400 focus:outline-none focus:ring-0 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:border-neutral-500 resize-none"
            />
            {currentQuestion.maxLength && (
              <p className="text-right text-xs text-neutral-400 dark:text-neutral-500">
                {currentAnswer?.type === "short_answer"
                  ? currentAnswer.value.length
                  : 0}
                /{currentQuestion.maxLength}
              </p>
            )}
          </div>
        )}

        {/* Slider Input */}
        {currentQuestion.type === "slider" && (
          <div className="space-y-6">
            {/* Current Value Display */}
            <div className="text-center">
              <span className="text-5xl font-semibold text-neutral-900 dark:text-neutral-100">
                {sliderCurrentValue}
              </span>
              {sliderValues.unit && (
                <span className="ml-2 text-lg text-neutral-500 dark:text-neutral-400">
                  {sliderValues.unit}
                </span>
              )}
            </div>

            {/* Slider */}
            <div className="px-2">
              <input
                type="range"
                min={sliderValues.min}
                max={sliderValues.max}
                step={sliderValues.step}
                value={sliderCurrentValue}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700 accent-neutral-900 dark:accent-neutral-100"
                style={{
                  background: `linear-gradient(to right, 
                    ${typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#f5f5f5' : '#171717'} 0%, 
                    ${typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#f5f5f5' : '#171717'} ${((sliderCurrentValue - sliderValues.min) / (sliderValues.max - sliderValues.min)) * 100}%, 
                    ${typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#404040' : '#e5e5e5'} ${((sliderCurrentValue - sliderValues.min) / (sliderValues.max - sliderValues.min)) * 100}%, 
                    ${typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#404040' : '#e5e5e5'} 100%)`
                }}
              />
            </div>

            {/* Min/Max Labels */}
            <div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
              <span>{sliderValues.minLabel ?? sliderValues.min}</span>
              <span>{sliderValues.maxLabel ?? sliderValues.max}</span>
            </div>

            {/* Quick Select Buttons */}
            <div className="flex justify-center gap-2 flex-wrap">
              {Array.from(
                { length: Math.min(sliderValues.max - sliderValues.min + 1, 11) },
                (_, i) => sliderValues.min + i * sliderValues.step
              )
                .filter((v) => v <= sliderValues.max)
                .map((value) => (
                  <button
                    key={value}
                    onClick={() => handleSliderChange(value)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all duration-150 ${
                      currentAnswer?.type === "slider" && currentAnswer.value === value
                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {value}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentHistoryIndex === 0}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
              currentHistoryIndex === 0
                ? "cursor-not-allowed text-neutral-300 dark:text-neutral-600"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-3">
            {!currentQuestion.required && (
              <button
                onClick={handleSkip}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-all duration-150 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Skip
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
                !canProceed()
                  ? "cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600"
                  : "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              }`}
            >
              Continue
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Question Indicators */}
      <div className="mt-12 flex justify-center gap-1.5">
        {questionHistory.map((q, index) => (
          <div
            key={q.id}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              index === currentHistoryIndex
                ? "w-6 bg-neutral-900 dark:bg-neutral-100"
                : index < currentHistoryIndex
                ? "w-1.5 bg-neutral-400 dark:bg-neutral-500"
                : "w-1.5 bg-neutral-200 dark:bg-neutral-700"
            }`}
          />
        ))}
        {/* Placeholder dots for remaining questions up to MAX */}
        {questionHistory.length < MAX_QUESTIONS &&
          Array.from({ length: MAX_QUESTIONS - questionHistory.length }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              className="h-1.5 w-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700"
            />
          ))}
      </div>
    </div>
  );
}
