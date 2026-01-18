import { NextRequest, NextResponse } from "next/server";
import {
  getClinicByIdForUser,
  getClinicById,
  getSubmissionsByClinic,
  createSubmission,
  rebalanceClinicQueue,
} from "@/lib/supabaseDataStore";
import { getCurrentUser } from "@/lib/supabaseAuth";
import type { AnswerRecord, Question } from "@/types/intake";
import type { PatientSummary } from "@/types/clinic";

// GET /api/clinics/[clinicId]/submissions - Get all submissions for a clinic (auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clinicId } = await params;
    const clinic = await getClinicByIdForUser(clinicId, user.id);

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const submissions = await getSubmissionsByClinic(clinicId);

    // Sort by most recent first (already sorted in query, but keeping for safety)
    const sorted = [...submissions].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    return NextResponse.json(sorted);
  } catch (error) {
    console.error("Get submissions error:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}

// POST /api/clinics/[clinicId]/submissions - Create a new patient submission (public - for patients)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const { clinicId } = await params;

  try {
    // Note: This is public - patients don't need to be authenticated
    // But the clinic must exist
    const clinic = await getClinicById(clinicId);

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const { patientName, patientEmail, questions, answers } = await request.json();

    if (!patientName || typeof patientName !== "string" || patientName.trim().length === 0) {
      return NextResponse.json(
        { error: "Patient name is required" },
        { status: 400 }
      );
    }

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Answers are required" },
        { status: 400 }
      );
    }

    const patientSummary = await generatePatientSummary(
      patientName.trim(),
      questions || [],
      answers as AnswerRecord
    );

    const submission = await createSubmission(
      clinicId,
      patientName.trim(),
      patientEmail?.trim(),
      questions || [],
      answers as AnswerRecord,
      patientSummary
    );

    await rebalanceClinicQueue(clinicId);

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("Create submission error:", error);
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }
}

function formatAnswer(answer?: AnswerRecord[keyof AnswerRecord]) {
  if (!answer) return "—";
  if (answer.type === "multiple_choice") return answer.selectedValue || "—";
  if (answer.type === "slider") return `${answer.value}`;
  if (answer.type === "short_answer") return answer.value || "—";
  return "—";
}

async function generatePatientSummary(
  patientName: string,
  questions: Question[],
  answers: AnswerRecord
): Promise<PatientSummary | undefined> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) return undefined;

  const qaLines = questions.map((question) => {
    const answer = answers[question.id];
    return `Q: ${question.question}\nA: ${formatAnswer(answer)}`;
  });

  const prompt = [
    `Patient name: ${patientName}`,
    "",
    "Intake Q&A:",
    qaLines.join("\n"),
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a medical scribe. Based on the intake Q&A, produce a concise JSON summary for a clinician. " +
              "Return ONLY valid JSON with keys: hpi (string), ros (array of strings), assessment_plan (array of strings). " +
              "The assessment_plan should be predictive but cautious, with differentials and next steps.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Patient summary error:", error);
      return undefined;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return undefined;

    const parsed = JSON.parse(content) as {
      hpi?: string;
      ros?: string[] | string;
      assessment_plan?: string[] | string;
    };

    return {
      hpi: parsed.hpi,
      ros: parsed.ros,
      assessmentPlan: parsed.assessment_plan,
    };
  } catch (error) {
    console.error("Patient summary error:", error);
    return undefined;
  }
}
