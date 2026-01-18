import { auth } from "@/lib/auth";
import { getClinicByIdForUser } from "@/lib/dataStore";
import { NextRequest, NextResponse } from "next/server";
import { getSubmissionById, updateSubmissionStatus } from "@/lib/dataStore";

// GET /api/submissions/[submissionId] - Get a specific submission (auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { submissionId } = await params;
    const submission = getSubmissionById(submissionId);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Verify the submission's clinic belongs to the user
    const clinic = getClinicByIdForUser(submission.clinicId, session.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("Get submission error:", error);
    return NextResponse.json({ error: "Failed to fetch submission" }, { status: 500 });
  }
}

// PATCH /api/submissions/[submissionId] - Update submission status (auth required)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { submissionId } = await params;
    const submission = getSubmissionById(submissionId);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Verify the submission's clinic belongs to the user
    const clinic = getClinicByIdForUser(submission.clinicId, session.user.id);
    if (!clinic) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const { status } = await request.json();

    if (!["pending", "reviewed", "archived"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const updated = updateSubmissionStatus(submissionId, status);

    if (!updated) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update submission error:", error);
    return NextResponse.json(
      { error: "Failed to update submission" },
      { status: 500 }
    );
  }
}
