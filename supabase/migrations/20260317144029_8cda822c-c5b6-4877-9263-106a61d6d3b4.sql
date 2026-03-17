
-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add senha_hash column
ALTER TABLE access_passwords ADD COLUMN IF NOT EXISTS senha_hash TEXT;

-- Populate hashes from existing plaintext passwords
UPDATE access_passwords SET senha_hash = crypt(senha, gen_salt('bf'));

-- Create active_sessions table
CREATE TABLE active_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  diretoria TEXT,
  area TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Sessions: public insert/read/delete (managed by SECURITY DEFINER functions)
CREATE POLICY "public_insert_session" ON active_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "public_read_session" ON active_sessions FOR SELECT USING (true);
CREATE POLICY "public_delete_session" ON active_sessions FOR DELETE USING (true);

-- Create session-based login function
CREATE OR REPLACE FUNCTION create_session(input_senha TEXT)
RETURNS TABLE (
  session_token TEXT,
  tipo TEXT,
  diretoria TEXT,
  area TEXT,
  responsavel TEXT,
  nome_display TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_result RECORD;
BEGIN
  SELECT ap.id, ap.tipo, ap.diretoria, ap.area, ap.responsavel, ap.nome_display
  INTO v_result
  FROM access_passwords ap
  WHERE ap.senha_hash = crypt(input_senha, ap.senha_hash);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO active_sessions (session_token, tipo, diretoria, area)
  VALUES (v_token, v_result.tipo, v_result.diretoria, v_result.area);

  DELETE FROM active_sessions WHERE expires_at < now();

  RETURN QUERY SELECT v_token, v_result.tipo, v_result.diretoria, v_result.area, v_result.responsavel, v_result.nome_display;
END;
$$;

-- Lock down access_passwords: no direct read
DROP POLICY IF EXISTS "public_read_passwords" ON access_passwords;
CREATE POLICY "no_direct_read" ON access_passwords FOR SELECT USING (false);

-- Lock down opex_records: read-only, no direct insert/delete
DROP POLICY IF EXISTS "public_read" ON opex_records;
DROP POLICY IF EXISTS "public_insert" ON opex_records;
DROP POLICY IF EXISTS "public_delete" ON opex_records;

CREATE POLICY "authenticated_read" ON opex_records FOR SELECT USING (true);
CREATE POLICY "no_direct_insert" ON opex_records FOR INSERT WITH CHECK (false);
CREATE POLICY "no_direct_delete" ON opex_records FOR DELETE USING (false);

-- Lock down opex_uploads similarly
DROP POLICY IF EXISTS "public_read_uploads" ON opex_uploads;
DROP POLICY IF EXISTS "public_insert_uploads" ON opex_uploads;
DROP POLICY IF EXISTS "public_delete_uploads" ON opex_uploads;

CREATE POLICY "read_uploads" ON opex_uploads FOR SELECT USING (true);
CREATE POLICY "no_direct_insert_uploads" ON opex_uploads FOR INSERT WITH CHECK (false);
CREATE POLICY "no_direct_delete_uploads" ON opex_uploads FOR DELETE USING (false);

-- Secure function: clear opex data (CEO only)
CREATE OR REPLACE FUNCTION clear_opex_data(p_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE session_token = p_session_token AND expires_at > now();

  IF NOT FOUND OR v_session.tipo != 'ceo' THEN
    RETURN false;
  END IF;

  DELETE FROM opex_records;
  DELETE FROM opex_uploads;
  RETURN true;
END;
$$;

-- Secure function: insert upload metadata (CEO only)
CREATE OR REPLACE FUNCTION insert_opex_upload(
  p_session_token TEXT,
  p_uploaded_by TEXT,
  p_filename TEXT,
  p_total_records INTEGER,
  p_meses_real INTEGER[],
  p_total_orcado NUMERIC,
  p_total_realizado NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_id UUID;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE session_token = p_session_token AND expires_at > now();

  IF NOT FOUND OR v_session.tipo != 'ceo' THEN
    RETURN NULL;
  END IF;

  INSERT INTO opex_uploads (uploaded_by, filename, total_records, meses_real, total_orcado, total_realizado)
  VALUES (p_uploaded_by, p_filename, p_total_records, p_meses_real, p_total_orcado, p_total_realizado)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Secure function: insert batch of opex records (CEO only)
CREATE OR REPLACE FUNCTION insert_opex_batch(p_session_token TEXT, p_records JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE session_token = p_session_token AND expires_at > now();

  IF NOT FOUND OR v_session.tipo != 'ceo' THEN
    RETURN -1;
  END IF;

  INSERT INTO opex_records (
    upload_id, base, centro_custo, descricao_ccusto, area_grupo1, diretoria,
    responsavel_area, conta_contabil, descricao_conta, recurso, pacote,
    debito, credito, executado, mes, tipo, data_lcto, numero_lote,
    historico, nome_fornecedor, desc_pedido, fornecedor_gerencial, origem, descr_origem
  )
  SELECT
    (r->>'upload_id')::UUID,
    r->>'base', r->>'centro_custo', r->>'descricao_ccusto', r->>'area_grupo1', r->>'diretoria',
    r->>'responsavel_area', r->>'conta_contabil', r->>'descricao_conta', r->>'recurso', r->>'pacote',
    (r->>'debito')::NUMERIC, (r->>'credito')::NUMERIC, (r->>'executado')::NUMERIC,
    (r->>'mes')::INTEGER, r->>'tipo', r->>'data_lcto', r->>'numero_lote',
    r->>'historico', r->>'nome_fornecedor', r->>'desc_pedido', r->>'fornecedor_gerencial',
    r->>'origem', r->>'descr_origem'
  FROM jsonb_array_elements(p_records) AS r;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
