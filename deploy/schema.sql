-- Control Drift - Enterprise Supabase Schema
-- Run this script in the Supabase SQL Editor to initialize your database structure.

-- 1. Create the Exercises table
CREATE TABLE IF NOT EXISTS public.exercises (
    "id" text PRIMARY KEY,
    "ttp" text,
    "simulation" text,
    "finding" text,
    "outcome" text,
    "coverageRating" text,
    "remediation" text,
    "status" text,
    "environment" jsonb DEFAULT '[]'::jsonb,
    "date" text,
    "tags" jsonb DEFAULT '[]'::jsonb,
    "securityControls" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create the Gaps table
CREATE TABLE IF NOT EXISTS public.gaps (
    "id" text PRIMARY KEY,
    "displayId" text,
    "ttp" text,
    "simulation" text,
    "finding" text,
    "outcome" text,
    "coverageRating" text,
    "details" text,
    "status" text,
    "severity" text,
    "priorityScore" numeric,
    "createdDate" text,
    "resolvedDate" text,
    "resolutionNotes" text,
    "environment" jsonb DEFAULT '[]'::jsonb,
    "actionItems" text,
    "stakeholders" jsonb DEFAULT '[]'::jsonb,
    "tags" jsonb DEFAULT '[]'::jsonb,
    "ticketLink" text,
    "aiRemediation" text,
    "todoList" jsonb DEFAULT '[]'::jsonb,
    "riskJustification" text,
    "riskAcceptedBy" text,
    "riskAcceptedDate" text,
    "validationNotes" text,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create the Simulations (Summaries) table
CREATE TABLE IF NOT EXISTS public.simulations (
    "id" text PRIMARY KEY,
    "summary" jsonb DEFAULT '{}'::jsonb,
    "evidence" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create User Roles table for RBAC
CREATE TABLE IF NOT EXISTS public.user_roles (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    "role" text NOT NULL DEFAULT 'operator',
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies allowing authenticated operators to read/write/update data
-- (Since this is a single-tenant enterprise setup, all authenticated operators share the workspace)

CREATE POLICY "Enable all for authenticated users" ON public.exercises
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON public.gaps
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON public.simulations
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON public.user_roles
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
