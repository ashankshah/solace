import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseAuth";
import {
  getClinicByIdForUser,
  getSubmissionById,
  updateSubmissionSummary,
} from "@/lib/supabaseDataStore";
import type { PatientSummary } from "@/types/clinic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { submissionId } = await params;
    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const clinic = await getClinicByIdForUser(submission.clinicId, user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const { transcript } = await request.json();
    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const existingSummary: PatientSummary = submission.summary || {};
    const summaryJson = JSON.stringify({
      hpi: existingSummary.hpi ?? "",
      ros: existingSummary.ros ?? [],
      assessment_plan: existingSummary.assessmentPlan ?? [],
      scientific_context: existingSummary.scientificContext ?? "",
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
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
              "You refine clinical notes using an audio transcript. " +
              "Return ONLY JSON with keys: hpi (string), ros (array of strings), assessment_plan (array of strings). " +
              "Incorporate only information explicitly present in the transcript. " +
              "Preserve prior content if the transcript does not add or contradict it. " +
              "Keep it concise and clinically relevant.",
          },
          {
            role: "user",
            content:
              `Existing summary (JSON):\n${summaryJson}\n\n` +
              `Transcript:\n${transcript}\n\n` +
              "Update the summary accordingly.",
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Refine notes error:", error);
      return NextResponse.json({ error: "Failed to refine notes" }, { status: 500 });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Failed to refine notes" }, { status: 500 });
    }

    const parsed = JSON.parse(content) as {
      hpi?: string;
      ros?: string[] | string;
      assessment_plan?: string[] | string;
    };

    const updatedSummary: PatientSummary = {
      hpi: parsed.hpi ?? existingSummary.hpi,
      ros: parsed.ros ?? existingSummary.ros,
      assessmentPlan: parsed.assessment_plan ?? existingSummary.assessmentPlan,
      scientificContext: existingSummary.scientificContext,
    };

    const updated = await updateSubmissionSummary(submissionId, updatedSummary);
    if (!updated) {
      return NextResponse.json({ error: "Failed to update summary" }, { status: 500 });
    }

    return NextResponse.json({ summary: updated.summary });
  } catch (error) {
    console.error("Refine notes error:", error);
    return NextResponse.json({ error: "Failed to refine notes" }, { status: 500 });
  }
}
