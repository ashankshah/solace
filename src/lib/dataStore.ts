// In-memory data store for clinics and patient submissions
// This can be replaced with a database in production

import type { Clinic, PatientSubmission } from "@/types/clinic";
import type { Question, AnswerRecord } from "@/types/intake";

// Default clinics (seed data)
const defaultClinics: Clinic[] = [
  {
    id: "clinic_1",
    name: "Solace Downtown",
    address: "123 Main St, Downtown",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "clinic_2", 
    name: "Solace Westside",
    address: "456 Oak Ave, Westside",
    createdAt: new Date("2024-01-15"),
  },
  {
    id: "clinic_3",
    name: "Solace Medical Center",
    address: "789 Health Blvd",
    createdAt: new Date("2024-02-01"),
  },
];

// In-memory stores
let clinics: Clinic[] = [...defaultClinics];
let submissions: PatientSubmission[] = [];

// Clinic operations
export function getAllClinics(): Clinic[] {
  return clinics;
}

export function getClinicById(id: string): Clinic | undefined {
  return clinics.find((c) => c.id === id);
}

export function createClinic(name: string, address?: string): Clinic {
  const clinic: Clinic = {
    id: `clinic_${Date.now()}`,
    name,
    address,
    createdAt: new Date(),
  };
  clinics.push(clinic);
  return clinic;
}

export function deleteClinic(id: string): boolean {
  const index = clinics.findIndex((c) => c.id === id);
  if (index === -1) return false;
  clinics.splice(index, 1);
  // Also delete associated submissions
  submissions = submissions.filter((s) => s.clinicId !== id);
  return true;
}

// Submission operations
export function getSubmissionsByClinic(clinicId: string): PatientSubmission[] {
  return submissions.filter((s) => s.clinicId === clinicId);
}

export function getSubmissionById(id: string): PatientSubmission | undefined {
  return submissions.find((s) => s.id === id);
}

export function createSubmission(
  clinicId: string,
  patientName: string,
  patientEmail: string | undefined,
  questions: Question[],
  answers: AnswerRecord
): PatientSubmission {
  const submission: PatientSubmission = {
    id: `submission_${Date.now()}`,
    clinicId,
    patientName,
    patientEmail,
    submittedAt: new Date(),
    questions,
    answers,
    status: "pending",
  };
  submissions.push(submission);
  return submission;
}

export function updateSubmissionStatus(
  id: string,
  status: PatientSubmission["status"]
): PatientSubmission | undefined {
  const submission = submissions.find((s) => s.id === id);
  if (submission) {
    submission.status = status;
  }
  return submission;
}

// Stats
export function getClinicStats(clinicId: string) {
  const clinicSubmissions = getSubmissionsByClinic(clinicId);
  return {
    totalPatients: clinicSubmissions.length,
    pendingCount: clinicSubmissions.filter((s) => s.status === "pending").length,
    reviewedCount: clinicSubmissions.filter((s) => s.status === "reviewed").length,
  };
}

// For testing/development - reset to default state
export function resetData(): void {
  clinics = [...defaultClinics];
  submissions = [];
}
