// Clinic and Patient Submission Types

import type { Question, AnswerRecord } from "./intake";

export interface Clinic {
  id: string;
  userId: string; // Owner of the clinic
  name: string;
  address?: string;
  createdAt: Date;
}

export interface PatientSubmission {
  id: string;
  clinicId: string;
  patientName: string;
  patientEmail?: string;
  submittedAt: Date;
  questions: Question[];
  answers: AnswerRecord;
  status: "pending" | "reviewed" | "archived";
}

// API Response types
export interface ClinicWithStats extends Clinic {
  patientCount: number;
  pendingCount: number;
}
