import { NextResponse } from "next/server";
import { getClinicsByUser, createClinic, getClinicStats } from "@/lib/dataStore";
import { auth } from "@/lib/auth";
import type { ClinicWithStats } from "@/types/clinic";

// GET /api/clinics - Get all clinics for the authenticated user
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const clinics = getClinicsByUser(session.user.id);
    
    const clinicsWithStats: ClinicWithStats[] = clinics.map((clinic) => {
      const stats = getClinicStats(clinic.id);
      return {
        ...clinic,
        patientCount: stats.totalPatients,
        pendingCount: stats.pendingCount,
      };
    });

    return NextResponse.json(clinicsWithStats);
  } catch (error) {
    console.error("Get clinics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clinics" },
      { status: 500 }
    );
  }
}

// POST /api/clinics - Create a new clinic for the authenticated user
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { name, address } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Clinic name is required" },
        { status: 400 }
      );
    }

    const clinic = createClinic(session.user.id, name.trim(), address?.trim());

    return NextResponse.json(clinic, { status: 201 });
  } catch (error) {
    console.error("Create clinic error:", error);
    return NextResponse.json(
      { error: "Failed to create clinic" },
      { status: 500 }
    );
  }
}
