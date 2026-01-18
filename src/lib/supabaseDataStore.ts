// Supabase-backed data store
// Replaces the in-memory dataStore with persistent Supabase storage

import { createAdminClient, createClient } from "./supabase/server";
import type { Clinic, PatientSubmission, PatientSummary } from "@/types/clinic";
import type { Question, AnswerRecord } from "@/types/intake";
import type { SafeUser } from "@/types/auth";
import type { ClinicLayout } from "@/types/layout";
import type { Json } from "./supabase/types";

function normalizePatientSummary(raw: unknown): PatientSummary | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const summary = raw as Record<string, unknown>;
  const hpi = typeof summary.hpi === "string" ? summary.hpi : undefined;
  const ros = summary.ros;
  const assessmentPlan = summary.assessment_plan ?? summary.assessmentPlan ?? summary.ap;
  const scientificContext = summary.scientificContext ?? summary.scientific_context;

  const normalized: PatientSummary = {
    hpi,
    ros: typeof ros === "string" || Array.isArray(ros) ? (ros as PatientSummary["ros"]) : undefined,
    assessmentPlan:
      typeof assessmentPlan === "string" || Array.isArray(assessmentPlan)
        ? (assessmentPlan as PatientSummary["assessmentPlan"])
        : undefined,
    scientificContext: typeof scientificContext === "string" ? scientificContext : undefined,
  };

  const hasContent = Object.values(normalized).some((value) =>
    Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0
  );

  return hasContent ? normalized : undefined;
}

function extractAnswersAndSummary(rawAnswers: unknown) {
  if (rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)) {
    const payload = rawAnswers as { responses?: AnswerRecord; summary?: unknown; patientSummary?: unknown };
    const summary = normalizePatientSummary(payload.summary ?? payload.patientSummary);
    if (payload.responses && typeof payload.responses === "object") {
      return { answers: payload.responses as AnswerRecord, summary };
    }
  }

  return { answers: rawAnswers as AnswerRecord, summary: undefined };
}

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
    ...(() => {
      const { answers, summary } = extractAnswersAndSummary(submission.answers);
      return {
        id: submission.id,
        clinicId: submission.clinic_id,
        patientName: submission.patient_name,
        patientEmail: submission.patient_email ?? undefined,
        submittedAt: new Date(submission.submitted_at),
        questions: submission.questions as Question[],
        answers,
        summary,
        status: submission.status,
      };
    })(),
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

  const { answers, summary } = extractAnswersAndSummary(data.answers);

  return {
    id: data.id,
    clinicId: data.clinic_id,
    patientName: data.patient_name,
    patientEmail: data.patient_email ?? undefined,
    submittedAt: new Date(data.submitted_at),
    questions: data.questions as Question[],
    answers,
    summary,
    status: data.status,
  };
}

export async function createSubmission(
  clinicId: string,
  patientName: string,
  patientEmail: string | undefined,
  questions: Question[],
  answers: AnswerRecord,
  summary?: PatientSummary
): Promise<PatientSubmission> {
  const supabase = await createClient();
  const answersPayload = summary ? { responses: answers, summary } : answers;

  const { data, error } = await supabase
    .from("patient_submissions")
    .insert({
      clinic_id: clinicId,
      patient_name: patientName,
      patient_email: patientEmail ?? null,
      questions: questions as unknown as Json,
      answers: answersPayload as unknown as Json,
      status: "pending",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error("Failed to create submission");
  }

  const { answers: storedAnswers, summary: storedSummary } = extractAnswersAndSummary(data.answers);

  return {
    id: data.id,
    clinicId: data.clinic_id,
    patientName: data.patient_name,
    patientEmail: data.patient_email ?? undefined,
    submittedAt: new Date(data.submitted_at),
    questions: data.questions as Question[],
    answers: storedAnswers,
    summary: storedSummary,
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

  const { answers, summary } = extractAnswersAndSummary(data.answers);

  return {
    id: data.id,
    clinicId: data.clinic_id,
    patientName: data.patient_name,
    patientEmail: data.patient_email ?? undefined,
    submittedAt: new Date(data.submitted_at),
    questions: data.questions as Question[],
    answers,
    summary,
    status: data.status,
  };
}

export async function updateSubmissionSummary(
  id: string,
  summary: PatientSummary
): Promise<PatientSubmission | null> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("patient_submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) return null;

  const { answers, summary: existingSummary } = extractAnswersAndSummary(existing.answers);
  const nextSummary = summary ?? existingSummary;
  const answersPayload = nextSummary
    ? { responses: answers, summary: nextSummary }
    : answers;

  const { data, error } = await supabase
    .from("patient_submissions")
    .update({
      answers: answersPayload as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;

  const { answers: storedAnswers, summary: storedSummary } = extractAnswersAndSummary(data.answers);

  return {
    id: data.id,
    clinicId: data.clinic_id,
    patientName: data.patient_name,
    patientEmail: data.patient_email ?? undefined,
    submittedAt: new Date(data.submitted_at),
    questions: data.questions as Question[],
    answers: storedAnswers,
    summary: storedSummary,
    status: data.status,
  };
}

export async function clearDischargedSubmissions(clinicId: string): Promise<number> {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("patient_submissions")
    .delete({ count: "exact" })
    .eq("clinic_id", clinicId)
    .eq("status", "archived");

  if (error) {
    throw new Error("Failed to clear discharged patients");
  }

  return count ?? 0;
}

export async function rebalanceClinicQueue(clinicId: string) {
  const supabase = await createAdminClient();

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("user_id")
    .eq("id", clinicId)
    .single();

  if (clinicError || !clinic) {
    console.error("Queue rebalance error: clinic not found", clinicError);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("clinic_layout")
    .eq("id", clinic.user_id)
    .single();

  if (profileError || !profile?.clinic_layout) {
    return;
  }

  const layout = profile.clinic_layout as ClinicLayout;
  const patientRoomCapacity = Array.isArray(layout.rooms)
    ? layout.rooms.filter((room) => room.type === "patient").length
    : 0;

  if (patientRoomCapacity <= 0) return;

  const { data: activeRows, error: activeError } = await supabase
    .from("patient_submissions")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("status", "reviewed");

  if (activeError) {
    console.error("Queue rebalance error: active fetch failed", activeError);
    return;
  }

  const activeCount = activeRows?.length ?? 0;
  if (activeCount >= patientRoomCapacity) return;

  const needed = patientRoomCapacity - activeCount;
  const { data: pendingRows, error: pendingError } = await supabase
    .from("patient_submissions")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(needed);

  if (pendingError || !pendingRows?.length) {
    if (pendingError) {
      console.error("Queue rebalance error: pending fetch failed", pendingError);
    }
    return;
  }

  const pendingIds = pendingRows.map((row) => row.id);
  const { error: promoteError } = await supabase
    .from("patient_submissions")
    .update({
      status: "reviewed",
      updated_at: new Date().toISOString(),
    })
    .in("id", pendingIds);

  if (promoteError) {
    console.error("Queue rebalance error: promote failed", promoteError);
  }
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
