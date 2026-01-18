// Supabase Database Types
// These types match the database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          clinic_layout: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          clinic_layout?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          clinic_layout?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clinics: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      patient_submissions: {
        Row: {
          id: string;
          clinic_id: string;
          patient_name: string;
          patient_email: string | null;
          submitted_at: string;
          questions: Json;
          answers: Json;
          status: "pending" | "reviewed" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          patient_name: string;
          patient_email?: string | null;
          submitted_at?: string;
          questions: Json;
          answers: Json;
          status?: "pending" | "reviewed" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          patient_name?: string;
          patient_email?: string | null;
          submitted_at?: string;
          questions?: Json;
          answers?: Json;
          status?: "pending" | "reviewed" | "archived";
          created_at?: string;
          updated_at?: string;
        };
      };
      transcripts: {
        Row: {
          id: string;
          clinic_id: string;
          submission_id: string | null;
          content: string;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          submission_id?: string | null;
          content: string;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          submission_id?: string | null;
          content?: string;
          duration_seconds?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      submission_status: "pending" | "reviewed" | "archived";
    };
  };
}

// Helper types for easier usage
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
export type PatientSubmission = Database["public"]["Tables"]["patient_submissions"]["Row"];
export type Transcript = Database["public"]["Tables"]["transcripts"]["Row"];
