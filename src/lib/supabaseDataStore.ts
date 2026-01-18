// Supabase-backed data store
// Replaces the in-memory dataStore with persistent Supabase storage

import { createClient } from "./supabase/server";
import type { Clinic, PatientSubmission } from "@/types/clinic";
import type { Question, AnswerRecord } from "@/types/intake";
import type { SafeUser } from "@/types/auth";
import type { ClinicLayout } from "@/types/layout";
import type { Json } from "./supabase/types";

// ============ USER/PROFILE OPERATIONS ============

export async function getProfile(userId: string): Promise<SafeUser | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    clinicLayout: data.clinic_layout as ClinicLayout | undefined,
    createdAt: new Date(data.created_at),
  };
}

export async function updateProfile(
  userId: string,
  updates: { name?: string; clinic_layout?: ClinicLayout }
): Promise<SafeUser | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      clinic_layout: updates.clinic_layout as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    clinicLayout: data.clinic_layout as ClinicLayout | undefined,
    createdAt: new Date(data.created_at),
  };
}

// ============ CLINIC LAYOUT OPERATIONS ============

export async function getUserClinicLayout(userId: string): Promise<ClinicLayout | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("clinic_layout")
    .eq("id", userId)
    .single();

  if (error || !data?.clinic_layout) return null;

  return data.clinic_layout as unknown as ClinicLayout;
}

export async function updateUserClinicLayout(
  userId: string,
  layout: ClinicLayout
): Promise<ClinicLayout | null> {
  const supabase = await createClient();

  const updatedLayout = {
    ...layout,
    updatedAt: new Date(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .update({
      clinic_layout: updatedLayout as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("clinic_layout")
    .single();

  if (error || !data?.clinic_layout) return null;

  return data.clinic_layout as unknown as ClinicLayout;
}

// ============ CLINIC OPERATIONS ============

export async function getClinicsByUser(userId: string): Promise<Clinic[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((clinic) => ({
    id: clinic.id,
    userId: clinic.user_id,
    name: clinic.name,
    address: clinic.address ?? undefined,
    createdAt: new Date(clinic.created_at),
  }));
}

export async function getClinicById(id: string): Promise<Clinic | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    address: data.address ?? undefined,
    createdAt: new Date(data.created_at),
  };
}

export async function getClinicByIdForUser(
  id: string,
  userId: string
): Promise<Clinic | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    address: data.address ?? undefined,
    createdAt: new Date(data.created_at),
  };
}

export async function createClinic(
  userId: string,
  name: string,
  address?: string
): Promise<Clinic> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinics")
    .insert({
      user_id: userId,
      name,
      address: address ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("Failed to create clinic");
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    address: data.address ?? undefined,
    createdAt: new Date(data.created_at),
  };
}

export async function updateClinic(
  id: string,
  userId: string,
  updates: { name?: string; address?: string }
): Promise<Clinic | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinics")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    address: data.address ?? undefined,
    createdAt: new Date(data.created_at),
  };
}

export async function deleteClinic(id: string, userId: string): Promise<boolean> {
  const supabase = await createClient();

  // Delete associated submissions first (cascade should handle this, but being explicit)
  await supabase
    .from("patient_submissions")
    .delete()
    .eq("clinic_id", id);

  const { error } = await supabase
    .from("clinics")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}

// ============ SUBMISSION OPERATIONS ============

export async function getSubmissionsByClinic(
  clinicId: string
): Promise<PatientSubmission[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("patient_submissions")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("submitted_at", { ascending: false });

  if (error || !data) return [];

  return data.map((submission) => ({
    id: submission.id,
    clinicId: submission.clinic_id,
    patientName: submission.patient_name,
    patientEmail: submission.patient_email ?? undefined,
    submittedAt: new Date(submission.submitted_at),
    questions: submission.questions as Question[],
    answers: submission.answers as AnswerRecord,
    status: submission.status,
  }));
}

export async function getSubmissionById(
  id: string
): Promise<PatientSubmission | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("patient_submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    clinicId: data.clinic_id,
    patientName: data.patient_name,
    patientEmail: data.patient_email ?? undefined,
    submittedAt: new Date(data.submitted_at),
    questions: data.questions as Question[],
    answers: data.answers as AnswerRecord,
    status: data.status,
  };
}

export async function createSubmission(
  clinicId: string,
  patientName: string,
  patientEmail: string | undefined,
  questions: Question[],
  answers: AnswerRecord
): Promise<PatientSubmission> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("patient_submissions")
    .insert({
      clinic_id: clinicId,
      patient_name: patientName,
      patient_email: patientEmail ?? null,
      questions: questions as unknown as Json,
      answers: answers as unknown as Json,
      status: "pending",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("Failed to create submission");
  }

  return {
    id: data.id,
    clinicId: data.clinic_id,
    patientName: data.patient_name,
    patientEmail: data.patient_email ?? undefined,
    submittedAt: new Date(data.submitted_at),
    questions: data.questions as Question[],
    answers: data.answers as AnswerRecord,
    status: data.status,
  };
}

export async function updateSubmissionStatus(
  id: string,
  status: PatientSubmission["status"]
): Promise<PatientSubmission | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("patient_submissions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    clinicId: data.clinic_id,
    patientName: data.patient_name,
    patientEmail: data.patient_email ?? undefined,
    submittedAt: new Date(data.submitted_at),
    questions: data.questions as Question[],
    answers: data.answers as AnswerRecord,
    status: data.status,
  };
}

// ============ TRANSCRIPT OPERATIONS ============

export async function saveTranscript(
  clinicId: string,
  content: string,
  submissionId?: string,
  durationSeconds?: number
): Promise<{ id: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transcripts")
    .insert({
      clinic_id: clinicId,
      submission_id: submissionId ?? null,
      content,
      duration_seconds: durationSeconds ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Failed to save transcript");
  }

  return { id: data.id };
}

export async function getTranscriptsByClinic(clinicId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data;
}

// ============ STATS ============

export async function getClinicStats(clinicId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("patient_submissions")
    .select("status")
    .eq("clinic_id", clinicId);

  if (error || !data) {
    return {
      totalPatients: 0,
      pendingCount: 0,
      reviewedCount: 0,
    };
  }

  return {
    totalPatients: data.length,
    pendingCount: data.filter((s) => s.status === "pending").length,
    reviewedCount: data.filter((s) => s.status === "reviewed").length,
  };
}

// ============ LOAD USER DATA ON LOGIN ============

export async function loadUserData(userId: string) {
  const [profile, clinics] = await Promise.all([
    getProfile(userId),
    getClinicsByUser(userId),
  ]);

  // Load submissions for each clinic
  const clinicsWithSubmissions = await Promise.all(
    clinics.map(async (clinic) => {
      const [submissions, stats] = await Promise.all([
        getSubmissionsByClinic(clinic.id),
        getClinicStats(clinic.id),
      ]);
      return {
        ...clinic,
        submissions,
        stats,
      };
    })
  );

  return {
    profile,
    clinics: clinicsWithSubmissions,
  };
}
