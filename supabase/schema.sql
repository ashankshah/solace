-- Supabase Database Schema for Solace
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  clinic_layout JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- CLINICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS clinics_user_id_idx ON public.clinics(user_id);

-- Enable RLS
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- Policies for clinics
CREATE POLICY "Users can view their own clinics"
  ON public.clinics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clinics"
  ON public.clinics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clinics"
  ON public.clinics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clinics"
  ON public.clinics FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PATIENT SUBMISSIONS TABLE
-- ============================================
CREATE TYPE submission_status AS ENUM ('pending', 'reviewed', 'archived');

CREATE TABLE IF NOT EXISTS public.patient_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status submission_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS patient_submissions_clinic_id_idx ON public.patient_submissions(clinic_id);
CREATE INDEX IF NOT EXISTS patient_submissions_status_idx ON public.patient_submissions(status);
CREATE INDEX IF NOT EXISTS patient_submissions_submitted_at_idx ON public.patient_submissions(submitted_at DESC);

-- Enable RLS
ALTER TABLE public.patient_submissions ENABLE ROW LEVEL SECURITY;

-- Policies for patient_submissions
-- Users can view submissions for their clinics
CREATE POLICY "Users can view submissions for their clinics"
  ON public.patient_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE clinics.id = patient_submissions.clinic_id
      AND clinics.user_id = auth.uid()
    )
  );

-- Anyone can create submissions (for patient check-in)
CREATE POLICY "Anyone can create submissions"
  ON public.patient_submissions FOR INSERT
  WITH CHECK (true);

-- Users can update submissions for their clinics
CREATE POLICY "Users can update submissions for their clinics"
  ON public.patient_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE clinics.id = patient_submissions.clinic_id
      AND clinics.user_id = auth.uid()
    )
  );

-- Users can delete submissions for their clinics
CREATE POLICY "Users can delete submissions for their clinics"
  ON public.patient_submissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE clinics.id = patient_submissions.clinic_id
      AND clinics.user_id = auth.uid()
    )
  );

-- ============================================
-- TRANSCRIPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.patient_submissions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS transcripts_clinic_id_idx ON public.transcripts(clinic_id);
CREATE INDEX IF NOT EXISTS transcripts_submission_id_idx ON public.transcripts(submission_id);

-- Enable RLS
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Policies for transcripts
CREATE POLICY "Users can view transcripts for their clinics"
  ON public.transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE clinics.id = transcripts.clinic_id
      AND clinics.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create transcripts for their clinics"
  ON public.transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE clinics.id = transcripts.clinic_id
      AND clinics.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete transcripts for their clinics"
  ON public.transcripts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE clinics.id = transcripts.clinic_id
      AND clinics.user_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_submissions_updated_at
  BEFORE UPDATE ON public.patient_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ALLOW PUBLIC ACCESS TO CLINICS FOR CHECK-IN
-- ============================================
-- This policy allows anyone to view clinic basic info for patient check-in
CREATE POLICY "Anyone can view clinic names for check-in"
  ON public.clinics FOR SELECT
  USING (true);
