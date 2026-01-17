// Question Types - Extensible for agentic workflow integration
// The agent will return questions matching these type definitions

export type QuestionType = "multiple_choice" | "short_answer" | "slider";

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  question: string;
  category?: string; // e.g., "symptoms", "medications", "allergies", "history"
  required?: boolean;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  options: string[];
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: "short_answer";
  placeholder?: string;
  maxLength?: number;
}

export interface SliderQuestion extends BaseQuestion {
  type: "slider";
  min: number;
  max: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  unit?: string; // e.g., "pain level", "days", "hours"
}

export type Question = MultipleChoiceQuestion | ShortAnswerQuestion | SliderQuestion;

// Answer types
export interface MultipleChoiceAnswer {
  questionId: string;
  type: "multiple_choice";
  selectedIndex: number;
  selectedValue: string;
}

export interface ShortAnswerAnswer {
  questionId: string;
  type: "short_answer";
  value: string;
}

export interface SliderAnswer {
  questionId: string;
  type: "slider";
  value: number;
}

export type Answer = MultipleChoiceAnswer | ShortAnswerAnswer | SliderAnswer;

export type AnswerRecord = Record<string, Answer>;

// Agent response type - what the AI agent will return
export interface AgentQuestionResponse {
  question: Question;
  context?: string; // Optional context for why this question is being asked
  followUpLogic?: {
    // For future: conditional follow-up questions
    condition: string;
    nextQuestionId: string;
  }[];
}

// Intake session type
export interface IntakeSession {
  sessionId: string;
  patientId?: string;
  startedAt: Date;
  completedAt?: Date;
  questions: Question[];
  answers: AnswerRecord;
  status: "in_progress" | "completed" | "abandoned";
}
