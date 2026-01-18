import { NextRequest, NextResponse } from "next/server";
import { getClinicByIdForUser, deleteClinic, getClinicStats } from "@/lib/dataStore";
import { auth } from "@/lib/auth";

// GET /api/clinics/[clinicId] - Get a specific clinic (must belong to user)
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

    const stats = getClinicStats(clinicId);

    return NextResponse.json({
      ...clinic,
      patientCount: stats.totalPatients,
      pendingCount: stats.pendingCount,
    });
  } catch (error) {
    console.error("Get clinic error:", error);
    return NextResponse.json({ error: "Failed to fetch clinic" }, { status: 500 });
  }
}

// DELETE /api/clinics/[clinicId] - Delete a clinic (must belong to user)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clinicId } = await params;
    const deleted = deleteClinic(clinicId, session.user.id);

    if (!deleted) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete clinic error:", error);
    return NextResponse.json({ error: "Failed to delete clinic" }, { status: 500 });
  }
}
