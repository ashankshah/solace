import { NextRequest, NextResponse } from "next/server";
import {
  getClinicByIdForUser,
  getClinicById,
  getSubmissionsByClinic,
  createSubmission,
} from "@/lib/dataStore";
import { auth } from "@/lib/auth";

// GET /api/clinics/[clinicId]/submissions - Get all submissions for a clinic (auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clinicId } = await params;
    const clinic = getClinicByIdForUser(clinicId, session.user.id);

    if (!clinic) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    const submissions = getSubmissionsByClinic(clinicId);

    // Sort by most recent first
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
    const clinic = getClinicById(clinicId);

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

    const submission = createSubmission(
      clinicId,
      patientName.trim(),
      patientEmail?.trim(),
      questions || [],
      answers
    );

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("Create submission error:", error);
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }
}
