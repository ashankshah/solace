import { NextResponse } from "next/server";
import { getAllClinics, createClinic, getClinicStats } from "@/lib/dataStore";
import type { ClinicWithStats } from "@/types/clinic";

// GET /api/clinics - Get all clinics with stats
export async function GET() {
  const clinics = getAllClinics();
  
  const clinicsWithStats: ClinicWithStats[] = clinics.map((clinic) => {
    const stats = getClinicStats(clinic.id);
    return {
      ...clinic,
      patientCount: stats.totalPatients,
      pendingCount: stats.pendingCount,
    };
  });

  return NextResponse.json(clinicsWithStats);
}

// POST /api/clinics - Create a new clinic
export async function POST(request: Request) {
  try {
    const { name, address } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Clinic name is required" },
        { status: 400 }
      );
    }

    const clinic = createClinic(name.trim(), address?.trim());

    return NextResponse.json(clinic, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create clinic" },
      { status: 500 }
    );
  }
}
