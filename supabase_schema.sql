-- Drop the table if it already exists to avoid errors when recreating
DROP TABLE IF EXISTS public.candidatas;

-- Create the candidatas table
CREATE TABLE public.candidatas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    idade INTEGER NOT NULL,
    contato TEXT NOT NULL,
    localidade TEXT NOT NULL,
    fotos_urls TEXT[] NOT NULL,
    autorizacao_url TEXT,
    votos INTEGER DEFAULT 0,
    aprovada BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on the table
ALTER TABLE public.candidatas ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (register)
CREATE POLICY "Allow public insert" ON public.candidatas
    FOR INSERT WITH CHECK (true);

-- Allow anyone to read (for the voting panel later)
CREATE POLICY "Allow public read" ON public.candidatas
    FOR SELECT USING (true);

-- Allow anyone to update (needed for the admin panel)
CREATE POLICY "Allow public update" ON public.candidatas
    FOR UPDATE USING (true);


-- Create the storage bucket for media (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('garota_regata_media', 'garota_regata_media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public to upload files
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
CREATE POLICY "Allow public uploads" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'garota_regata_media');

-- Allow public to read files
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
CREATE POLICY "Allow public reads" ON storage.objects
    FOR SELECT USING (bucket_id = 'garota_regata_media');

-- Enable Realtime for the candidatas table
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidatas;

-- Create the profiles table for judges
CREATE TABLE public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    login TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and add public policies for profiles (simple access for this app)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- Create the notas_traje_banho table
CREATE TABLE public.notas_traje_banho (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    jurado_id UUID REFERENCES public.profiles(id) NOT NULL,
    candidata_id UUID REFERENCES public.candidatas(id) NOT NULL,
    desenvoltura INTEGER CHECK (desenvoltura IN (8, 9, 10)),
    postura INTEGER CHECK (postura IN (8, 9, 10)),
    passarela INTEGER CHECK (passarela IN (8, 9, 10)),
    elegancia INTEGER CHECK (elegancia IN (8, 9, 10)),
    simpatia INTEGER CHECK (simpatia IN (8, 9, 10)),
    beleza INTEGER CHECK (beleza IN (8, 9, 10)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(jurado_id, candidata_id)
);

-- Enable RLS and add public policies for notas_traje_banho
ALTER TABLE public.notas_traje_banho ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read notas banho" ON public.notas_traje_banho FOR SELECT USING (true);
CREATE POLICY "Allow public insert notas banho" ON public.notas_traje_banho FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update notas banho" ON public.notas_traje_banho FOR UPDATE USING (true);

-- Create the notas_traje_tipico table
CREATE TABLE public.notas_traje_tipico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    jurado_id UUID REFERENCES public.profiles(id) NOT NULL,
    candidata_id UUID REFERENCES public.candidatas(id) NOT NULL,
    criatividade_originalidade INTEGER CHECK (criatividade_originalidade IN (8, 9, 10)),
    fidelidade_tema INTEGER CHECK (fidelidade_tema IN (8, 9, 10)),
    representatividade_cultural INTEGER CHECK (representatividade_cultural IN (8, 9, 10)),
    postura INTEGER CHECK (postura IN (8, 9, 10)),
    apresentacao_candidata INTEGER CHECK (apresentacao_candidata IN (8, 9, 10)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(jurado_id, candidata_id)
);

-- Enable RLS and add public policies for notas_traje_tipico
ALTER TABLE public.notas_traje_tipico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read notas tipico" ON public.notas_traje_tipico FOR SELECT USING (true);
CREATE POLICY "Allow public insert notas tipico" ON public.notas_traje_tipico FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update notas tipico" ON public.notas_traje_tipico FOR UPDATE USING (true);

-- Adicionar colunas de penalidade na tabela candidatas
ALTER TABLE public.candidatas 
ADD COLUMN IF NOT EXISTS penalidade_pontos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalidade_motivo TEXT;
