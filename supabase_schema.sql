-- Supabase Database Setup Script
-- Run this in the Supabase SQL Editor (https://app.supabase.com/)

-- 1. Create 'quotations' table
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider JSONB NOT NULL DEFAULT '{}'::jsonb,
    customer JSONB NOT NULL DEFAULT '{}'::jsonb,
    quoteNumber TEXT,
    greeting TEXT,
    remarks TEXT,
    total_amount NUMERIC
);

-- 2. Create 'measurements_v2' table
CREATE TABLE IF NOT EXISTS public.measurements_v2 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    site_name TEXT,
    customer_name TEXT,
    date TEXT,
    measurer TEXT,
    doors JSONB NOT NULL DEFAULT '[]'::jsonb,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    power_source TEXT,
    floor_condition TEXT,
    obstacles TEXT,
    special_notes TEXT
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements_v2 ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Users can only see/edit their own data based on auth.uid()
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own quotations') THEN
        CREATE POLICY "Users can insert their own quotations" ON public.quotations FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own quotations') THEN
        CREATE POLICY "Users can view their own quotations" ON public.quotations FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own quotations') THEN
        CREATE POLICY "Users can update their own quotations" ON public.quotations FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own quotations') THEN
        CREATE POLICY "Users can delete their own quotations" ON public.quotations FOR DELETE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own measurements') THEN
        CREATE POLICY "Users can insert their own measurements" ON public.measurements_v2 FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own measurements') THEN
        CREATE POLICY "Users can view their own measurements" ON public.measurements_v2 FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own measurements') THEN
        CREATE POLICY "Users can update their own measurements" ON public.measurements_v2 FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own measurements') THEN
        CREATE POLICY "Users can delete their own measurements" ON public.measurements_v2 FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- =============================================
-- 누락된 테이블 추가 (아래 SQL을 Supabase SQL Editor에서 실행하세요)
-- =============================================

-- 5. company_profiles 테이블 (공급자 정보 저장)
CREATE TABLE IF NOT EXISTS public.company_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    name TEXT,
    brand_tagline TEXT,
    representative TEXT,
    business_no TEXT,
    address TEXT,
    contact TEXT,
    logo_data_url TEXT,
    company_intro TEXT
);

-- 6. projects 테이블 (현장 관리)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    site_name TEXT,
    customer_name TEXT,
    total_amount NUMERIC DEFAULT 0,
    invoice_date TEXT,
    invoice_status TEXT DEFAULT '미발급',
    payment_date TEXT,
    payment_status TEXT DEFAULT '미수금',
    notes TEXT,
    biz_name TEXT,
    biz_owner TEXT,
    biz_address TEXT,
    biz_type TEXT,
    biz_item TEXT,
    biz_email TEXT
);

-- 7. work_items 테이블 (공정 항목)
CREATE TABLE IF NOT EXISTS public.work_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    label TEXT,
    type TEXT DEFAULT '시공',
    date TEXT,
    status TEXT DEFAULT '실측예정'
);

-- 8. subcontracts 테이블 (외주 관리)
CREATE TABLE IF NOT EXISTS public.subcontracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    label TEXT,
    amount NUMERIC DEFAULT 0,
    invoice_issued BOOLEAN DEFAULT false,
    payment_done BOOLEAN DEFAULT false,
    date TEXT
);

-- RLS 활성화
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontracts ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DO $$
BEGIN
    -- company_profiles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own company_profiles') THEN
        CREATE POLICY "Users can manage their own company_profiles" ON public.company_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    -- projects
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own projects') THEN
        CREATE POLICY "Users can manage their own projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    -- work_items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own work_items') THEN
        CREATE POLICY "Users can manage their own work_items" ON public.work_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    -- subcontracts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own subcontracts') THEN
        CREATE POLICY "Users can manage their own subcontracts" ON public.subcontracts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
