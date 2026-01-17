"use client";

import { useState } from "react";
import type { Question, Answer, AnswerRecord } from "@/types/intake";

interface QuizProps {
  questions: Question[];
  onComplete: (answers: AnswerRecord) => void;
}

export default function Quiz({ questions, onComplete }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord>({});
  const [currentAnswer, setCurrentAnswer] = useState<Answer | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentIndex === questions.length - 1;

  const canProceed = (): boolean => {
    if (!currentQuestion.required && !currentAnswer) return true;
    if (!currentAnswer) return false;
    if (currentAnswer.type === "short_answer") {
      return currentAnswer.value.trim().length > 0 || !currentQuestion.required;
    }
    return true;
  };

  const handleMultipleChoiceSelect = (optionIndex: number) => {
    if (currentQuestion.type !== "multiple_choice") return;
    setCurrentAnswer({
      questionId: currentQuestion.id,
      type: "multiple_choice",
      selectedIndex: optionIndex,
      selectedValue: currentQuestion.options[optionIndex],
    });
  };

  const handleShortAnswerChange = (value: string) => {
    if (currentQuestion.type !== "short_answer") return;
    setCurrentAnswer({
      questionId: currentQuestion.id,
      type: "short_answer",
      value,
    });
  };

  const handleNext = () => {
    if (!canProceed()) return;

    const newAnswers: AnswerRecord = { ...answers };
    if (currentAnswer) {
      newAnswers[currentQuestion.id] = currentAnswer;
    }
    setAnswers(newAnswers);

    if (isLastQuestion) {
      onComplete(newAnswers);
    } else {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
        // Restore previous answer if going back
        const nextQuestion = questions[currentIndex + 1];
        setCurrentAnswer(newAnswers[nextQuestion.id] ?? null);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      // Save current answer before going back
      if (currentAnswer) {
        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: currentAnswer }));
      }
      
      setIsAnimating(true);
      setTimeout(() => {
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);
        setCurrentAnswer(answers[questions[prevIndex].id] ?? null);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleSkip = () => {
    if (currentQuestion.required) return;
    
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      const nextQuestion = questions[currentIndex + 1];
      setCurrentAnswer(answers[nextQuestion.id] ?? null);
      setIsAnimating(false);
    }, 200);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-10">
        <div className="mb-2 flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <span>
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className="h-full rounded-full bg-neutral-900 dark:bg-neutral-100 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
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

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
              currentIndex === 0
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
            {!currentQuestion.required && !isLastQuestion && (
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
              {isLastQuestion ? "Submit" : "Continue"}
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
        {questions.map((q, index) => (
          <div
            key={q.id}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              index === currentIndex
                ? "w-6 bg-neutral-900 dark:bg-neutral-100"
                : index < currentIndex
                ? "w-1.5 bg-neutral-400 dark:bg-neutral-500"
                : "w-1.5 bg-neutral-200 dark:bg-neutral-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
