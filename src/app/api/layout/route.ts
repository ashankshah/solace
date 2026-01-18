import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseAuth";
import { getUserClinicLayout, updateUserClinicLayout } from "@/lib/supabaseDataStore";
import { createEmptyLayout } from "@/types/layout";
import type { ClinicLayout } from "@/types/layout";

// GET /api/layout - Get the current user's clinic layout
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const layout = await getUserClinicLayout(user.id);
    
    // Return empty layout if none exists
    if (!layout) {
      return NextResponse.json(createEmptyLayout());
    }

    return NextResponse.json(layout);
  } catch (error) {
    console.error("Get layout error:", error);
    return NextResponse.json(
      { error: "Failed to fetch layout" },
      { status: 500 }
    );
  }
}

// PUT /api/layout - Update the current user's clinic layout
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate the layout structure
    if (!body.rooms || !Array.isArray(body.rooms)) {
      return NextResponse.json(
        { error: "Invalid layout: rooms array is required" },
        { status: 400 }
      );
    }

    // Validate each room
    for (const room of body.rooms) {
      if (!room.id || !room.type || !room.name) {
        return NextResponse.json(
          { error: "Invalid room: id, type, and name are required" },
          { status: 400 }
        );
      }
      if (!['waiting', 'patient'].includes(room.type)) {
        return NextResponse.json(
          { error: "Invalid room type: must be 'waiting' or 'patient'" },
          { status: 400 }
        );
      }
      if (typeof room.x !== 'number' || typeof room.y !== 'number' ||
          typeof room.width !== 'number' || typeof room.height !== 'number') {
        return NextResponse.json(
          { error: "Invalid room: x, y, width, and height must be numbers" },
          { status: 400 }
        );
      }
    }

    const layout: ClinicLayout = {
      rooms: body.rooms,
      gridCols: body.gridCols || 12,
      gridRows: body.gridRows || 8,
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
      updatedAt: new Date(),
    };

    const updated = await updateUserClinicLayout(user.id, layout);
    
    if (!updated) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update layout error:", error);
    return NextResponse.json(
      { error: "Failed to update layout" },
      { status: 500 }
    );
  }
}
