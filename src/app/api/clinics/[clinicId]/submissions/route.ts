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
    if (!patientSummary) {
      console.warn("Patient summary missing; skipping scientific context.");
    }
    const summaryWithContext = await attachScientificContext(patientSummary);

    const submission = await createSubmission(
      clinicId,
      patientName.trim(),
      patientEmail?.trim(),
      questions || [],
      answers as AnswerRecord,
      summaryWithContext
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

async function attachScientificContext(
  summary?: PatientSummary
): Promise<PatientSummary | undefined> {
  if (!summary) return undefined;

  const scientificContext = await fetchScientificContext({
    hpi: summary.hpi,
    ros: summary.ros,
    ap: summary.assessmentPlan,
  });

  return {
    ...summary,
    scientificContext,
  };
}

async function fetchScientificContext({
  hpi,
  ros,
  ap,
}: {
  hpi?: string;
  ros?: string[] | string;
  ap?: string[] | string;
}): Promise<string> {
  const coreApiKey = process.env.CORE_API_KEY;
  if (!coreApiKey) {
    console.warn("CORE_API_KEY missing; skipping scientific context.");
    return "";
  }

  // Build a CORE search query from the summary content.
  const query = await buildCoreQueryFromSummary({ hpi, ros, ap });
  if (!query) {
    console.warn("CORE query unavailable; skipping scientific context.");
    return "";
  }
  console.log("CORE query built (length):", query.length);

  try {
    // Query CORE API v3 for relevant papers.
    const response = await fetch("https://api.core.ac.uk/v3/search/outputs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${coreApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        limit: 5,
        offset: 0,
      }),
    });

    if (response.status === 429) {
      console.warn("CORE API rate limit hit.");
      return "";
    }

    if (!response.ok) {
      const error = await response.text();
      console.error("CORE API error:", error);
      return "";
    }

    const data = await response.json();
    const items = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.results?.items)
        ? data.results.items
        : Array.isArray(data?.outputs)
          ? data.outputs
          : Array.isArray(data?.data)
            ? data.data
            : [];
    console.log("CORE results count:", items.length);

    const snippets: string[] = [];
    for (const item of items) {
      const abstract = typeof item?.abstract === "string"
        ? item.abstract
        : typeof item?.metadata?.abstract === "string"
          ? item.metadata.abstract
          : typeof item?._source?.abstract === "string"
            ? item._source.abstract
            : typeof item?.document?.abstract === "string"
              ? item.document.abstract
              : "";
      // Take the first sentence only.
      const sentence = getFirstSentence(abstract);
      if (sentence) snippets.push(sentence);
    }
    console.log("CORE abstracts used:", snippets.length);

    return snippets.join(" ").trim();
  } catch (error) {
    console.error("CORE API error:", error);
    return "";
  }
}

async function buildCoreQueryFromSummary({
  hpi,
  ros,
  ap,
}: {
  hpi?: string;
  ros?: string[] | string;
  ap?: string[] | string;
}): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const summaryText = [
    hpi || "",
    Array.isArray(ros) ? ros.join(" ") : ros || "",
    Array.isArray(ap) ? ap.join(" ") : ap || "",
  ]
    .join(" ")
    .trim();

  if (!summaryText) return "";

  if (!openaiApiKey) {
    return buildFallbackQuery(summaryText);
  }

  try {
    // Use an LLM to produce a CORE-friendly query string.
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You create CORE API v3 search queries. Return ONLY JSON: {\"query\":\"...\"}. " +
              "Prioritize recall over precision; keep queries broad and permissive. " +
              "Prefer OR between 3-6 key terms (symptoms, conditions, differentials). " +
              "You MAY use title:/abstract:, but do not require them. " +
              "Use quotes for multi-word phrases only if necessary. Avoid patient identifiers. " +
              "Keep the query under 200 characters.",
          },
          {
            role: "user",
            content: `Summary:\n${summaryText}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("CORE query LLM error:", error);
      return buildFallbackQuery(summaryText);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return buildFallbackQuery(summaryText);

    const parsed = JSON.parse(content) as { query?: string };
    if (typeof parsed.query === "string" && parsed.query.trim().length > 0) {
      const fallback = buildFallbackQuery(summaryText);
      return fallback ? `(${parsed.query}) OR (${fallback})` : parsed.query;
    }
    return buildFallbackQuery(summaryText);
  } catch (error) {
    console.error("CORE query LLM error:", error);
    return buildFallbackQuery(summaryText);
  }
}

function buildFallbackQuery(summaryText: string) {
  const tokens = summaryText
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3);

  const uniqueTokens = Array.from(new Set(tokens)).slice(0, 6);
  if (uniqueTokens.length === 0) return "";

  const terms = uniqueTokens.map((token) => {
    const sanitized = token.replace(/"/g, "");
    return `(title:"${sanitized}" OR abstract:"${sanitized}" OR ${sanitized})`;
  });

  return terms.join(" OR ");
}

function getFirstSentence(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const index = cleaned.indexOf(".");
  if (index === -1) return cleaned;
  return cleaned.slice(0, index).trim();
}
