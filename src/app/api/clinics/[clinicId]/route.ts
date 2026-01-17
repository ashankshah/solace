import { NextRequest, NextResponse } from "next/server";
import { getClinicById, deleteClinic, getClinicStats } from "@/lib/dataStore";

// GET /api/clinics/[clinicId] - Get a specific clinic
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const { clinicId } = await params;
  const clinic = getClinicById(clinicId);

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  const stats = getClinicStats(clinicId);

  return NextResponse.json({
    ...clinic,
    patientCount: stats.totalPatients,
    pendingCount: stats.pendingCount,
  });
}

// DELETE /api/clinics/[clinicId] - Delete a clinic
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  const { clinicId } = await params;
  const deleted = deleteClinic(clinicId);

  if (!deleted) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
