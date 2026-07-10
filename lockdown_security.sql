-- ========================================================
-- SCRIPT DE SEGURANÇA E BLOQUEIO (ANTI-VAZAMENTO E HACKERS)
-- ========================================================

-- 1. Remover acesso público aos votos (bloqueia o vazamento de resultados)
DROP POLICY IF EXISTS "Allow public read votos" ON public.votos;
DROP POLICY IF EXISTS "Block public read votos" ON public.votos;
CREATE POLICY "Block public read votos" ON public.votos FOR SELECT USING (false);

-- 2. Remover acesso público à tabela candidatas (protege dados sensíveis como CPF, contato)
DROP POLICY IF EXISTS "Allow public read" ON public.candidatas;
DROP POLICY IF EXISTS "Block public read candidatas" ON public.candidatas;
CREATE POLICY "Block public read candidatas" ON public.candidatas FOR SELECT USING (false);

-- 3. Criar View Segura para exibição pública de candidatas (apenas o necessário para votar)
CREATE OR REPLACE VIEW public.candidatas_publicas AS
SELECT id, nome, localidade, idade, fotos_urls
FROM public.candidatas
WHERE aprovada = true;

-- Garantir acesso de leitura na view para usuários anônimos
GRANT SELECT ON public.candidatas_publicas TO anon, authenticated;

-- 4. Função RPC segura para o painel ler todas as candidatas (com dados sensíveis)
CREATE OR REPLACE FUNCTION admin_obter_candidatas(senha TEXT)
RETURNS SETOF public.candidatas AS $$
BEGIN
    IF NOT public.verificar_senha_admin(senha) THEN
        RAISE EXCEPTION 'Senha de administrador incorreta.';
    END IF;
    RETURN QUERY SELECT * FROM public.candidatas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função RPC segura para o painel ler a contagem de votos
CREATE OR REPLACE FUNCTION admin_obter_votos(senha TEXT)
RETURNS TABLE (candidata_id UUID) AS $$
BEGIN
    IF NOT public.verificar_senha_admin(senha) THEN
        RAISE EXCEPTION 'Senha de administrador incorreta.';
    END IF;
    RETURN QUERY SELECT v.candidata_id FROM public.votos v;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função RPC segura para o painel ler dados de auditoria
CREATE OR REPLACE FUNCTION admin_obter_votos_auditoria(senha TEXT)
RETURNS TABLE (created_at TIMESTAMP WITH TIME ZONE, candidata_id UUID, device_fingerprint TEXT) AS $$
BEGIN
    IF NOT public.verificar_senha_admin(senha) THEN
        RAISE EXCEPTION 'Senha de administrador incorreta.';
    END IF;
    RETURN QUERY SELECT v.created_at, v.candidata_id, v.device_fingerprint 
                 FROM public.votos v 
                 ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Atualização da função de registro de votos para dupla verificação (Anti Cross-Browser)
CREATE OR REPLACE FUNCTION registrar_voto(c_id UUID, fingerprint TEXT, ip_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificar se já votou pelo IP+Hardware (mesmo wifi, mesma resolução e OS)
    IF EXISTS (SELECT 1 FROM public.votos WHERE device_fingerprint LIKE '%___' || ip_hash) THEN
        RAISE EXCEPTION 'Voto duplicado. Este aparelho já votou.';
    END IF;

    -- Verificar se já votou pela digital do navegador original
    IF EXISTS (SELECT 1 FROM public.votos WHERE device_fingerprint LIKE fingerprint || '___%') THEN
        RAISE EXCEPTION 'Voto duplicado. Este aparelho já votou.';
    END IF;

    -- Inserir novo formato composto
    INSERT INTO public.votos (candidata_id, device_fingerprint)
    VALUES (c_id, fingerprint || '___' || ip_hash);
    
    RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Voto duplicado. Este aparelho já votou.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
