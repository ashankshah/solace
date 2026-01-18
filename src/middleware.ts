import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all paths except static files and public API routes
    "/((?!_next/static|_next/image|favicon.ico|api/seed|checkin|intake|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
