import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseAuth";
import { clearDischargedSubmissions, getClinicByIdForUser } from "@/lib/supabaseDataStore";

export async function POST(
  request: Request,
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

    const clearedCount = await clearDischargedSubmissions(clinicId);
    return NextResponse.json({ clearedCount });
  } catch (error) {
    console.error("Clear discharged error:", error);
    return NextResponse.json({ error: "Failed to clear discharged patients" }, { status: 500 });
  }
}
