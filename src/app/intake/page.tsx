"use client";

import { useState } from "react";
import DynamicQuiz from "@/components/DynamicQuiz";
import type { AnswerRecord } from "@/types/intake";
import { Button, Card, Header, HeaderBranding, SuccessCheckIcon } from "@/components/ui";

// Next steps component
function NextSteps({ steps }: { steps: string[] }) {
	return (
		<Card>
			<h2 className="mb-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wider uppercase">
				What happens next
			</h2>
			<ol className="space-y-4">
				{steps.map((step, index) => (
					<li key={index} className="flex items-start gap-3">
						<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700 dark:bg-accent-500/20 dark:text-accent-400">
							{index + 1}
						</span>
						<span className="text-sm text-neutral-600 dark:text-neutral-300 pt-0.5">
							{step}
						</span>
					</li>
				))}
			</ol>
		</Card>
	);
}

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
			<div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
				<div className="flex min-h-screen flex-col items-center justify-center px-6">
					<div className="w-full max-w-md">
						{/* Success Icon */}
						<div className="mb-8 flex justify-center">
							<SuccessCheckIcon />
						</div>

						{/* Content */}
						<div className="text-center mb-10">
							<h1 className="mb-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
								Thank you
							</h1>
							<p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
								Your intake form has been submitted. Our system is preparing your
								clinical summary.
							</p>
						</div>

						{/* Summary of answers */}
						<Card className="mb-6">
							<h2 className="mb-4 text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wider uppercase">
								Your responses
							</h2>
							<div className="space-y-3 max-h-64 overflow-y-auto pr-1">
								{Object.entries(answers).map(([questionId, answer]) => (
									<div key={questionId}>
										<p className="text-neutral-500 dark:text-neutral-400 text-xs mb-1">
											{questionId
												.replace(/_/g, " ")
												.replace(/q \d+ \d+/, "")
												.trim() || questionId}
										</p>
										<p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg px-3 py-2">
											{answer.type === "multiple_choice"
												? answer.selectedValue
												: answer.type === "slider"
													? answer.value
													: answer.value || "—"}
										</p>
									</div>
								))}
							</div>
						</Card>

						{/* Next Steps */}
						<NextSteps
							steps={[
								"AI generates your clinical summary",
								"Room assignment is optimized",
								"You'll be called when ready",
							]}
						/>

						{/* Action */}
						<Button
							onClick={() => {
								setCompleted(false);
								setAnswers({});
							}}
							className="mt-6 w-full"
							size="lg"
						>
							Start new intake
						</Button>
				</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
			{/* Header */}
			<Header maxWidth="3xl">
				<HeaderBranding subtitle="Patient Intake" />
			</Header>

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
