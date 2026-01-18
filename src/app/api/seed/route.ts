import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/dataStore";

// POST /api/seed - Seed demo data for development
export async function POST() {
  try {
    await seedDemoData();
    return NextResponse.json({ 
      message: "Demo data seeded successfully",
      demoAccount: {
        email: "demo@solace.health",
        password: "demo123"
      }
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed data" },
      { status: 500 }
    );
  }
}
