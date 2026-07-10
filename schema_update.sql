-- 🔒 TABELAS DE SEGURANÇA E CONFIGURAÇÕES
-- ==========================================

-- 1. Remover acesso público aos votos (bloqueia o vazamento de resultados)
DROP POLICY IF EXISTS "Allow public read votos" ON public.votos;
CREATE POLICY "Block public read votos" ON public.votos FOR SELECT USING (false);

-- 2. Remover acesso público à tabela candidatas (protege dados sensíveis como CPF, contato)
DROP POLICY IF EXISTS "Allow public read" ON public.candidatas;
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
