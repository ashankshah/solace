// Supabase Auth utilities for server-side authentication
import { createClient } from "./supabase/server";
import type { SafeUser } from "@/types/auth";

// Get current authenticated user
export async function getCurrentUser(): Promise<SafeUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Return basic user info if profile doesn't exist yet
    return {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
      createdAt: new Date(user.created_at),
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    clinicLayout: profile.clinic_layout as SafeUser["clinicLayout"],
    createdAt: new Date(profile.created_at),
  };
}

// Get current session
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

// Require authentication - throws if not authenticated
export async function requireAuth(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

// Sign out
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}
