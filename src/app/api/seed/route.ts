import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// POST /api/seed - Seed demo data for development
// Note: With Supabase, you should set up demo data through the Supabase dashboard
// or use migrations. This endpoint creates a demo clinic for testing.
export async function POST() {
  try {
    const supabase = await createAdminClient();
    
    // Create a demo clinic (users should sign up via Supabase Auth)
    const { data: demoClinic, error: clinicError } = await supabase
      .from("clinics")
      .upsert({
        id: "demo-clinic-1",
        user_id: "00000000-0000-0000-0000-000000000000", // Placeholder for demo
        name: "Demo Medical Center",
        address: "123 Health Street, Medical City, MC 12345",
      }, { onConflict: "id" })
      .select()
      .single();

    if (clinicError && clinicError.code !== "23505") {
      console.error("Failed to create demo clinic:", clinicError);
    }

    return NextResponse.json({ 
      message: "Demo data seeded successfully. Sign up via the app to create a real account.",
      demoClinic: demoClinic?.id || "demo-clinic-1",
      note: "User authentication is now handled by Supabase. Use the signup page to create an account."
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed data" },
      { status: 500 }
    );
  }
}
