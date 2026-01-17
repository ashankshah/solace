"use client";

import { useState } from "react";
import DynamicQuiz from "@/components/DynamicQuiz";
import type { AnswerRecord } from "@/types/intake";

export default function IntakePage() {
	const [completed, setCompleted] = useState(false);
	const [answers, setAnswers] = useState<AnswerRecord>({});

	const handleComplete = (finalAnswers: AnswerRecord) => {
		setAnswers(finalAnswers);
		setCompleted(true);

		// Log answers in a readable format
		console.log("Quiz completed with answers:");
		Object.entries(finalAnswers).forEach(([questionId, answer]) => {
			if (answer.type === "multiple_choice") {
				console.log(`  ${questionId}: ${answer.selectedValue}`);
			} else if (answer.type === "slider") {
				console.log(`  ${questionId}: ${answer.value}`);
			} else {
				console.log(`  ${questionId}: "${answer.value}"`);
			}
		});
	};

	if (completed) {
		return (
			<div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
				<div className="flex min-h-screen flex-col items-center justify-center px-6">
					<div className="w-full max-w-md">
						{/* Success Icon */}
						<div className="mb-8 flex justify-center">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100">
								<svg
									className="h-8 w-8 text-white dark:text-neutral-900"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2.5}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
						</div>

						{/* Content */}
						<div className="text-center mb-10">
							<h1 className="mb-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
								Thank you
							</h1>
							<p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
								Your intake form has been submitted. Our system is preparing
								clinical summary.
							</p>
						</div>

						{/* Summary of answers */}
						<div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800 mb-6">
							<h2 className="mb-4 text-sm font-medium text-neutral-900 dark:text-neutral-100 tracking-wide uppercase">
								Your responses
							</h2>
							<div className="space-y-3 max-h-64 overflow-y-auto">
								{Object.entries(answers).map(([questionId, answer]) => (
									<div key={questionId} className="text-sm">
										<p className="text-neutral-500 dark:text-neutral-400 text-xs mb-1">
											{questionId
												.replace(/_/g, " ")
												.replace(/q \d+ \d+/, "")
												.trim() || questionId}
										</p>
										<p className="text-neutral-700 dark:text-neutral-300">
											{answer.type === "multiple_choice"
												? answer.selectedValue
												: answer.type === "slider"
												? answer.value
												: answer.value || "—"}
										</p>
									</div>
								))}
							</div>
						</div>

						{/* Next Steps */}
						<div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
							<h2 className="mb-4 text-sm font-medium text-neutral-900 dark:text-neutral-100 tracking-wide uppercase">
								What happens next
							</h2>
							<ol className="space-y-4">
								{[
									"AI generates your clinical summary",
									"Room assignment is optimized",
									"You'll be called when ready",
								].map((step, index) => (
									<li key={index} className="flex items-start gap-3">
										<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
											{index + 1}
										</span>
										<span className="text-sm text-neutral-600 dark:text-neutral-300 pt-0.5">
											{step}
										</span>
									</li>
								))}
							</ol>
						</div>

						{/* Action */}
						<button
							onClick={() => {
								setCompleted(false);
								setAnswers({});
							}}
							className="mt-6 w-full rounded-lg bg-neutral-900 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
						>
							Start new intake
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
			{/* Header */}
			<header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
				<div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100">
							<svg
								className="h-4 w-4 text-white dark:text-neutral-900"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
								/>
							</svg>
						</div>
						<span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
							Solace
						</span>
					</div>
					<span className="text-sm text-neutral-500 dark:text-neutral-400">
						Patient Intake
					</span>
				</div>
			</header>

			{/* Main Content */}
			<main className="mx-auto max-w-3xl px-6 py-16">
				<div className="mb-12 text-center">
					<h1 className="mb-3 text-3xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
						Welcome to your visit
					</h1>
					<p className="text-neutral-500 dark:text-neutral-400">
						Answer a few questions to help us provide you with the best care.
					</p>
				</div>

				<DynamicQuiz onComplete={handleComplete} />
			</main>
		</div>
	);
}
