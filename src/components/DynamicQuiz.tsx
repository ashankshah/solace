"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Question, Answer, AnswerRecord } from "@/types/intake";
import { fetchNextQuestion, generateFallbackQuestions } from "@/lib/questions";
import { Button, Spinner, Badge, Textarea, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "@/components/ui";
import { cn } from "@/lib/utils";

interface DynamicQuizProps {
  onComplete: (answers: AnswerRecord) => void;
  onQuestionAsked?: (question: Question) => void;
}

type QuizState = "loading" | "question" | "complete" | "error";

// Progress bar component
function ProgressBar({ current, max, progress }: { current: number; max: number; progress: number }) {
  return (
    <div className="mb-10">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-400 font-medium">
          Question {current} of {max}
        </span>
        <span className="text-accent-600 dark:text-accent-400 font-semibold">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Question indicators (dots)
function QuestionIndicators({ 
  history, 
  currentIndex, 
  maxQuestions 
}: { 
  history: Question[]; 
  currentIndex: number; 
  maxQuestions: number;
}) {
  return (
    <div className="mt-12 flex justify-center gap-1.5">
      {history.map((q, index) => (
        <div
          key={q.id}
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            index === currentIndex
              ? "w-6 bg-accent-500"
              : index < currentIndex
                ? "w-1.5 bg-accent-300 dark:bg-accent-600"
                : "w-1.5 bg-neutral-200 dark:bg-neutral-700"
          )}
        />
      ))}
      {/* Placeholder dots for remaining questions up to MAX */}
      {history.length < maxQuestions &&
        Array.from({ length: maxQuestions - history.length }).map((_, i) => (
          <div
            key={`placeholder-${i}`}
            className="h-1.5 w-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700"
          />
        ))}
    </div>
  );
}

// Multiple choice option component
function MultipleChoiceOption({
  option,
  index,
  isSelected,
  onSelect,
}: {
  option: string;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group w-full rounded-xl border p-4 text-left transition-all duration-150",
        isSelected
          ? "border-accent-500 bg-accent-50 ring-2 ring-accent-500/20 dark:border-accent-500 dark:bg-accent-500/10"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
            isSelected
              ? "border-accent-500 bg-accent-500"
              : "border-neutral-300 bg-transparent dark:border-neutral-600"
          )}
        >
          {isSelected ? (
            <CheckIcon />
          ) : (
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
              {String.fromCharCode(65 + index)}
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-base leading-snug",
            isSelected
              ? "font-medium text-accent-700 dark:text-accent-300"
              : "text-neutral-700 dark:text-neutral-300"
          )}
        >
          {option}
        </span>
      </div>
    </button>
  );
}

// Slider input component
function SliderInput({
  min,
  max,
  step,
  value,
  minLabel,
  maxLabel,
  unit,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  minLabel?: string;
  maxLabel?: string;
  unit?: string;
  onChange: (value: number) => void;
}) {
  // Calculate gradient for slider track
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="space-y-6">
      {/* Current Value Display */}
      <div className="text-center">
        <span className="text-5xl font-semibold text-accent-600 dark:text-accent-400">
          {value}
        </span>
        {unit && (
          <span className="ml-2 text-lg text-neutral-500 dark:text-neutral-400">
            {unit}
          </span>
        )}
      </div>

      {/* Slider */}
      <div className="px-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, 
              #f97316 0%, 
              #f97316 ${percentage}%, 
              ${typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#404040' : '#e5e5e5'} ${percentage}%, 
              ${typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#404040' : '#e5e5e5'} 100%)`
          }}
        />
      </div>

      {/* Min/Max Labels */}
      <div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
        <span>{minLabel ?? min}</span>
        <span>{maxLabel ?? max}</span>
      </div>

      {/* Quick Select Buttons */}
      <div className="flex justify-center gap-2 flex-wrap">
        {Array.from(
          { length: Math.min(max - min + 1, 11) },
          (_, i) => min + i * step
        )
          .filter((v) => v <= max)
          .map((v) => (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={cn(
                "w-10 h-10 rounded-xl text-sm font-medium transition-all duration-150",
                value === v
                  ? "bg-accent-500 text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
              )}
            >
              {v}
            </button>
          ))}
      </div>
    </div>
  );
}

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
          <Spinner 
            size="lg" 
            label={questionHistory.length === 0 ? "Preparing your intake..." : "Generating next question..."} 
          />
        </div>
      </div>
    );
  }

  // Error state with fallback active notification
  if (state === "error") {
    return (
      <div className="w-full max-w-xl mx-auto">
        <div className="rounded-xl border border-error-200 bg-error-50 p-6 dark:border-error-500/30 dark:bg-error-500/10">
          <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
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
        <div className="mb-6 rounded-xl border border-warning-200 bg-warning-50 p-3 dark:border-warning-500/30 dark:bg-warning-500/10">
          <p className="text-xs text-warning-700 dark:text-warning-400">
            Using standard questions (AI unavailable)
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <ProgressBar 
        current={currentHistoryIndex + 1} 
        max={MAX_QUESTIONS} 
        progress={progress} 
      />

      {/* Question Card */}
      <div
        className={cn(
          "transition-all duration-200 ease-out",
          isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        )}
      >
        {/* Question Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-accent-600 dark:text-accent-400 tracking-wider uppercase">
              {currentQuestion.category ?? "Health Assessment"}
            </p>
            {!currentQuestion.required && (
              <Badge variant="default" size="sm">Optional</Badge>
            )}
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight">
            {currentQuestion.question}
          </h2>
        </div>

        {/* Multiple Choice Options */}
        {currentQuestion.type === "multiple_choice" && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <MultipleChoiceOption
                key={index}
                option={option}
                index={index}
                isSelected={
                  currentAnswer?.type === "multiple_choice" &&
                  currentAnswer.selectedIndex === index
                }
                onSelect={() => handleMultipleChoiceSelect(index)}
              />
            ))}
          </div>
        )}

        {/* Short Answer Input */}
        {currentQuestion.type === "short_answer" && (
          <div className="space-y-2">
            <Textarea
              value={currentAnswer?.type === "short_answer" ? currentAnswer.value : ""}
              onChange={(e) => handleShortAnswerChange(e.target.value)}
              placeholder={currentQuestion.placeholder}
              maxLength={currentQuestion.maxLength}
              rows={4}
              className="resize-none"
            />
            {currentQuestion.maxLength && (
              <p className="text-right text-xs text-neutral-400 dark:text-neutral-500">
                {currentAnswer?.type === "short_answer" ? currentAnswer.value.length : 0}
                /{currentQuestion.maxLength}
              </p>
            )}
          </div>
        )}

        {/* Slider Input */}
        {currentQuestion.type === "slider" && (
          <SliderInput
            min={sliderValues.min}
            max={sliderValues.max}
            step={sliderValues.step}
            value={sliderCurrentValue}
            minLabel={sliderValues.minLabel}
            maxLabel={sliderValues.maxLabel}
            unit={sliderValues.unit}
            onChange={handleSliderChange}
          />
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentHistoryIndex === 0}
            leftIcon={<ChevronLeftIcon />}
          >
            Back
          </Button>

          <div className="flex items-center gap-3">
            {!currentQuestion.required && (
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              rightIcon={<ChevronRightIcon />}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>

      {/* Question Indicators */}
      <QuestionIndicators 
        history={questionHistory} 
        currentIndex={currentHistoryIndex} 
        maxQuestions={MAX_QUESTIONS} 
      />
    </div>
  );
}
