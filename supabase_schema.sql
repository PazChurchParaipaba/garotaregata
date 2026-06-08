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
