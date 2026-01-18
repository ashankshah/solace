import { NextResponse } from "next/server";
import { createUser } from "@/lib/dataStore";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Validate name
    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }

    const user = await createUser(email, password, name.trim());

    return NextResponse.json(
      { user, message: "Account created successfully" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Email already registered") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
