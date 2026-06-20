-- O arquivo foi atualizado para NÃO apagar tabelas existentes.
-- Create the candidatas table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.candidatas (
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
DROP POLICY IF EXISTS "Allow public insert" ON public.candidatas;
CREATE POLICY "Allow public insert" ON public.candidatas
    FOR INSERT WITH CHECK (true);

-- Allow anyone to read (for the voting panel later)
DROP POLICY IF EXISTS "Allow public read" ON public.candidatas;
CREATE POLICY "Allow public read" ON public.candidatas
    FOR SELECT USING (true);

-- DROP da política de UPDATE caso ela exista, para manter a tabela travada
DROP POLICY IF EXISTS "Allow public update" ON public.candidatas;

-- REMOVED: Public UPDATE policy to prevent unauthorized changes
-- CREATE POLICY "Allow public update" ON public.candidatas FOR UPDATE USING (true);


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

-- Enable Realtime for tables securely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'candidatas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.candidatas;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'votos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.votos;
    END IF;
END $$;

-- Create the profiles table for judges
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    login TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and add public policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- REMOVED: Public read to protect passwords
-- CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- Create the notas_traje_banho table
CREATE TABLE IF NOT EXISTS public.notas_traje_banho (
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

DROP POLICY IF EXISTS "Allow public read notas banho" ON public.notas_traje_banho;
CREATE POLICY "Allow public read notas banho" ON public.notas_traje_banho FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert notas banho" ON public.notas_traje_banho;
CREATE POLICY "Allow public insert notas banho" ON public.notas_traje_banho FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update notas banho" ON public.notas_traje_banho;
CREATE POLICY "Allow public update notas banho" ON public.notas_traje_banho FOR UPDATE USING (true);

-- Create the notas_traje_tipico table
CREATE TABLE IF NOT EXISTS public.notas_traje_tipico (
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

DROP POLICY IF EXISTS "Allow public read notas tipico" ON public.notas_traje_tipico;
CREATE POLICY "Allow public read notas tipico" ON public.notas_traje_tipico FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert notas tipico" ON public.notas_traje_tipico;
CREATE POLICY "Allow public insert notas tipico" ON public.notas_traje_tipico FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update notas tipico" ON public.notas_traje_tipico;
CREATE POLICY "Allow public update notas tipico" ON public.notas_traje_tipico FOR UPDATE USING (true);

-- Adicionar colunas de penalidade na tabela candidatas
ALTER TABLE public.candidatas 
ADD COLUMN IF NOT EXISTS penalidade_pontos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalidade_motivo TEXT;

-- ==========================================
-- 🔒 TABELAS DE SEGURANÇA E CONFIGURAÇÕES
-- ==========================================

-- Tabela de Configurações (Guarda senha e data)
CREATE TABLE IF NOT EXISTS public.configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);

-- Inserir senha padrão do painel (PODE SER ALTERADA AQUI)
INSERT INTO public.configuracoes (chave, valor) 
VALUES ('admin_senha', 'regata2026') ON CONFLICT DO NOTHING;

-- Tabela de Votos
CREATE TABLE IF NOT EXISTS public.votos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidata_id UUID REFERENCES public.candidatas(id) NOT NULL,
    device_fingerprint TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Votos (Bloqueia INSERT direto)
ALTER TABLE public.votos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read votos" ON public.votos;
CREATE POLICY "Allow public read votos" ON public.votos FOR SELECT USING (true);

-- ==========================================
-- 🔒 FUNÇÕES SEGURAS (RPC)
-- ==========================================

-- Função para registrar voto travando o fingerprint
CREATE OR REPLACE FUNCTION registrar_voto(c_id UUID, fingerprint TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO public.votos (candidata_id, device_fingerprint)
    VALUES (c_id, fingerprint);
    
    -- Incrementa contagem (opcional se contarmos via COUNT na tabela, mas como otimização podemos somar)
    -- UPDATE public.candidatas SET votos = votos + 1 WHERE id = c_id;
    
    RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Voto duplicado. Este aparelho já votou.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Função para verificar senha do admin
CREATE OR REPLACE FUNCTION verificar_senha_admin(senha_tentativa TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    senha_real TEXT;
BEGIN
    SELECT valor INTO senha_real FROM public.configuracoes WHERE chave = 'admin_senha';
    IF senha_real = senha_tentativa THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Função Admin: Aprovar/Desaprovar
CREATE OR REPLACE FUNCTION admin_aprovar_candidata(c_id UUID, is_aprovada BOOLEAN, senha TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT verificar_senha_admin(senha) THEN
        RAISE EXCEPTION 'Senha de administrador incorreta.';
    END IF;
    
    UPDATE public.candidatas SET aprovada = is_aprovada WHERE id = c_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Função Admin: Penalizar
CREATE OR REPLACE FUNCTION admin_penalizar(c_id UUID, pontos INTEGER, motivo TEXT, senha TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    pontos_atuais INTEGER;
    motivo_atual TEXT;
BEGIN
    IF NOT verificar_senha_admin(senha) THEN
        RAISE EXCEPTION 'Senha de administrador incorreta.';
    END IF;

    SELECT penalidade_pontos, penalidade_motivo INTO pontos_atuais, motivo_atual 
    FROM public.candidatas WHERE id = c_id;

    UPDATE public.candidatas 
    SET penalidade_pontos = COALESCE(pontos_atuais, 0) + pontos,
        penalidade_motivo = CASE 
            WHEN motivo_atual IS NULL OR motivo_atual = '' THEN motivo 
            ELSE motivo_atual || CHR(10) || motivo 
        END
    WHERE id = c_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Função Jurado: Login Seguro
CREATE OR REPLACE FUNCTION login_jurado_seguro(nome_jurado TEXT, senha_jurado TEXT)
RETURNS JSON AS $$
DECLARE
    jurado_record RECORD;
BEGIN
    SELECT id, nome_completo INTO jurado_record FROM public.profiles 
    WHERE nome_completo = nome_jurado AND password = senha_jurado LIMIT 1;
    
    IF FOUND THEN
        RETURN json_build_object('success', true, 'id', jurado_record.id, 'nome', jurado_record.nome_completo);
    ELSE
        RETURN json_build_object('success', false);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
