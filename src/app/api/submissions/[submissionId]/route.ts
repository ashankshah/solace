import { NextRequest, NextResponse } from "next/server";
import { getSubmissionById, updateSubmissionStatus } from "@/lib/dataStore";

// GET /api/submissions/[submissionId] - Get a specific submission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await params;
  const submission = getSubmissionById(submissionId);

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json(submission);
}

// PATCH /api/submissions/[submissionId] - Update submission status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await params;

  try {
    const { status } = await request.json();

    if (!["pending", "reviewed", "archived"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const submission = updateSubmissionStatus(submissionId, status);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch {
    return NextResponse.json(
      { error: "Failed to update submission" },
      { status: 500 }
    );
  }
}
