import { Question, MultipleChoiceQuestion, ShortAnswerQuestion, SliderQuestion, AnswerRecord } from "@/types/intake";

/**
 * Question Generator Utilities
 * 
 * These helper functions create properly typed questions.
 * An agentic workflow can use these to generate questions dynamically.
 */

let questionIdCounter = 0;

function generateQuestionId(): string {
  return `q_${++questionIdCounter}_${Date.now()}`;
}

// Factory function for multiple choice questions
export function createMultipleChoiceQuestion(
  question: string,
  options: string[],
  config?: {
    id?: string;
    category?: string;
    required?: boolean;
  }
): MultipleChoiceQuestion {
  return {
    id: config?.id ?? generateQuestionId(),
    type: "multiple_choice",
    question,
    options,
    category: config?.category,
    required: config?.required ?? true,
  };
}

// Factory function for short answer questions
export function createShortAnswerQuestion(
  question: string,
  config?: {
    id?: string;
    category?: string;
    placeholder?: string;
    maxLength?: number;
    required?: boolean;
  }
): ShortAnswerQuestion {
  return {
    id: config?.id ?? generateQuestionId(),
    type: "short_answer",
    question,
    placeholder: config?.placeholder ?? "Type your answer here...",
    maxLength: config?.maxLength ?? 500,
    category: config?.category,
    required: config?.required ?? true,
  };
}

// Factory function for slider questions
export function createSliderQuestion(
  question: string,
  config: {
    id?: string;
    category?: string;
    required?: boolean;
    min: number;
    max: number;
    step?: number;
    minLabel?: string;
    maxLabel?: string;
    unit?: string;
  }
): SliderQuestion {
  return {
    id: config?.id ?? generateQuestionId(),
    type: "slider",
    question,
    min: config.min,
    max: config.max,
    step: config.step ?? 1,
    minLabel: config.minLabel,
    maxLabel: config.maxLabel,
    unit: config.unit,
    category: config?.category,
    required: config?.required ?? true,
  };
}

/**
 * Fetch the next question from the AI agent
 * This calls the API route which uses OpenAI to generate contextual questions
 */
export async function fetchNextQuestion(
  answers: AnswerRecord,
  questionCount: number,
  questionHistory?: Question[]
): Promise<{ question: Question } | { complete: true } | { error: string }> {
  try {
    // Prepare question history with full context for the AI
    const historyForAPI = questionHistory?.map(q => {
      const base = {
        id: q.id,
        question: q.question,
        category: q.category,
        type: q.type,
      };
      
      // Include additional details based on question type
      if (q.type === "multiple_choice") {
        return { ...base, options: q.options };
      } else if (q.type === "slider") {
        return { 
          ...base, 
          min: q.min, 
          max: q.max, 
          minLabel: q.minLabel, 
          maxLabel: q.maxLabel,
          unit: q.unit 
        };
      }
      return base;
    });

    console.log("[fetchNextQuestion] Sending to API:", {
      questionCount,
      answerCount: Object.keys(answers).length,
      historyLength: historyForAPI?.length || 0,
    });

    const response = await fetch("/api/intake/next-question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        answers, 
        questionCount,
        questionHistory: historyForAPI
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch question" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching question:", error);
    return { error: "Network error" };
  }
}

/**
 * Fallback questions if API is unavailable
 */
export function generateFallbackQuestions(): Question[] {
  questionIdCounter = 0;

  return [
    createMultipleChoiceQuestion(
      "What best describes your main reason for visiting today?",
      [
        "Routine check-up or preventive care",
        "New symptoms or health concern",
        "Follow-up on an existing condition",
        "Prescription refill or medication review",
      ],
      { category: "screening", id: "reason_for_visit" }
    ),
    createShortAnswerQuestion(
      "Please briefly describe your main symptoms or concerns.",
      {
        category: "symptoms",
        id: "symptom_description",
        placeholder: "Describe what you're experiencing...",
        maxLength: 300,
      }
    ),
    createMultipleChoiceQuestion(
      "How long have you been experiencing these symptoms?",
      [
        "Less than 24 hours",
        "1-3 days",
        "4-7 days",
        "More than a week",
      ],
      { category: "symptoms", id: "symptom_duration" }
    ),
    createSliderQuestion(
      "How would you rate your current pain or discomfort level?",
      {
        category: "severity",
        id: "pain_level",
        min: 0,
        max: 10,
        step: 1,
        minLabel: "No pain",
        maxLabel: "Worst pain imaginable",
        unit: "pain level",
      }
    ),
    createMultipleChoiceQuestion(
      "Are you currently taking any medications?",
      [
        "No medications",
        "1-2 medications",
        "3-5 medications",
        "More than 5 medications",
      ],
      { category: "medications", id: "medication_count" }
    ),
    createShortAnswerQuestion(
      "Please list your current medications and dosages.",
      {
        category: "medications",
        id: "medication_list",
        placeholder: "e.g., Lisinopril 10mg daily, Metformin 500mg twice daily...",
        maxLength: 500,
        required: false,
      }
    ),
    createMultipleChoiceQuestion(
      "Do you have any known allergies?",
      [
        "No known allergies",
        "Medication allergies",
        "Food allergies",
        "Environmental allergies",
        "Multiple types of allergies",
      ],
      { category: "allergies", id: "allergy_type" }
    ),
    createShortAnswerQuestion(
      "Is there anything else you'd like us to know before your visit?",
      {
        category: "additional",
        id: "additional_notes",
        placeholder: "Any other concerns, questions, or information...",
        maxLength: 500,
        required: false,
      }
    ),
  ];
}

// Keep for backwards compatibility
export const generateIntakeQuestions = generateFallbackQuestions;
