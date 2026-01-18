// In-memory data store for clinics, patient submissions, and users
// This can be replaced with a database in production

import type { Clinic, PatientSubmission } from "@/types/clinic";
import type { Question, AnswerRecord } from "@/types/intake";
import type { User, SafeUser } from "@/types/auth";
import type { ClinicLayout } from "@/types/layout";
import bcrypt from "bcryptjs";

// In-memory stores
let users: User[] = [];
let clinics: Clinic[] = [];
let submissions: PatientSubmission[] = [];

// ============ USER OPERATIONS ============

export async function createUser(
  email: string,
  password: string,
  name: string
): Promise<SafeUser> {
  // Check if email already exists
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user: User = {
    id: `user_${Date.now()}`,
    email: email.toLowerCase(),
    name,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  users.push(user);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export async function verifyUser(
  email: string,
  password: string
): Promise<SafeUser | null> {
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export function getUserById(id: string): SafeUser | undefined {
  const user = users.find((u) => u.id === id);
  if (!user) return undefined;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    clinicLayout: user.clinicLayout,
    createdAt: user.createdAt,
  };
}

export function getUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

// ============ CLINIC LAYOUT OPERATIONS ============

export function getUserClinicLayout(userId: string): ClinicLayout | undefined {
  const user = users.find((u) => u.id === userId);
  return user?.clinicLayout;
}

export function updateUserClinicLayout(
  userId: string,
  layout: ClinicLayout
): ClinicLayout | undefined {
  const user = users.find((u) => u.id === userId);
  if (!user) return undefined;

  user.clinicLayout = {
    ...layout,
    updatedAt: new Date(),
  };
  user.updatedAt = new Date();

  return user.clinicLayout;
}

// ============ CLINIC OPERATIONS ============

export function getAllClinics(): Clinic[] {
  return clinics;
}

export function getClinicsByUser(userId: string): Clinic[] {
  return clinics.filter((c) => c.userId === userId);
}

export function getClinicById(id: string): Clinic | undefined {
  return clinics.find((c) => c.id === id);
}

export function getClinicByIdForUser(id: string, userId: string): Clinic | undefined {
  return clinics.find((c) => c.id === id && c.userId === userId);
}

export function createClinic(userId: string, name: string, address?: string): Clinic {
  const clinic: Clinic = {
    id: `clinic_${Date.now()}`,
    userId,
    name,
    address,
    createdAt: new Date(),
  };
  clinics.push(clinic);
  return clinic;
}

export function deleteClinic(id: string, userId: string): boolean {
  const index = clinics.findIndex((c) => c.id === id && c.userId === userId);
  if (index === -1) return false;
  clinics.splice(index, 1);
  // Also delete associated submissions
  submissions = submissions.filter((s) => s.clinicId !== id);
  return true;
}

// ============ SUBMISSION OPERATIONS ============

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

// ============ STATS ============

export function getClinicStats(clinicId: string) {
  const clinicSubmissions = getSubmissionsByClinic(clinicId);
  return {
    totalPatients: clinicSubmissions.length,
    pendingCount: clinicSubmissions.filter((s) => s.status === "pending").length,
    reviewedCount: clinicSubmissions.filter((s) => s.status === "reviewed").length,
  };
}

// ============ FOR TESTING/DEVELOPMENT ============

export function resetData(): void {
  users = [];
  clinics = [];
  submissions = [];
}

// Seed a demo account for development
export async function seedDemoData(): Promise<void> {
  // Only seed if no users exist
  if (users.length > 0) return;

  const demoUser = await createUser(
    "demo@solace.health",
    "demo123",
    "Demo Clinic Admin"
  );

  createClinic(demoUser.id, "Solace Downtown", "123 Main St, Downtown");
  createClinic(demoUser.id, "Solace Westside", "456 Oak Ave, Westside");
  createClinic(demoUser.id, "Solace Medical Center", "789 Health Blvd");
}
