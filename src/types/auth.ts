// User and Authentication Types
import type { DefaultSession } from "next-auth";
import type { ClinicLayout } from "./layout";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  clinicLayout?: ClinicLayout;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

// Safe user type without password
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  clinicLayout?: ClinicLayout;
  createdAt: Date;
}

// Auth API types
export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: SafeUser;
  token?: string;
}

// NextAuth type extensions
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    name: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string;
  }
}
