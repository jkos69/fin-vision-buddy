-- Tabela capex_uploads
CREATE TABLE public.capex_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_name TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  total_orcado NUMERIC NOT NULL DEFAULT 0,
  total_realizado NUMERIC NOT NULL DEFAULT 0
);

-- Tabela capex_records
CREATE TABLE public.capex_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES public.capex_uploads(id) ON DELETE CASCADE,
  base TEXT NOT NULL,
  tipo TEXT,
  centro_custo TEXT,
  desc_centro_custo TEXT,
  area TEXT,
  diretoria TEXT,
  responsavel_area TEXT,
  nome_projeto TEXT,
  projeto_novo TEXT,
  sponsor_projeto TEXT,
  cod_fornecedor TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  conta_contabil TEXT,
  desc_conta_contabil TEXT,
  grupo_pacotes TEXT,
  grupo_contas_1 TEXT,
  grupo_contas_2 TEXT,
  item_contabil TEXT,
  executado NUMERIC NOT NULL DEFAULT 0,
  mes_num INTEGER NOT NULL,
  historico TEXT,
  data_lancamento TEXT,
  nf_numero TEXT,
  pedido_numero TEXT,
  desc_pedido TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capex_records_base ON public.capex_records(base);
CREATE INDEX idx_capex_records_tipo ON public.capex_records(tipo);
CREATE INDEX idx_capex_records_diretoria ON public.capex_records(diretoria);
CREATE INDEX idx_capex_records_area ON public.capex_records(area);
CREATE INDEX idx_capex_records_nome_projeto ON public.capex_records(nome_projeto);
CREATE INDEX idx_capex_records_grupo_pacotes ON public.capex_records(grupo_pacotes);
CREATE INDEX idx_capex_records_mes_num ON public.capex_records(mes_num);

ALTER TABLE public.capex_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capex_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_capex_uploads" ON public.capex_uploads FOR SELECT USING (true);
CREATE POLICY "no_direct_insert_capex_uploads" ON public.capex_uploads FOR INSERT WITH CHECK (false);
CREATE POLICY "no_direct_update_capex_uploads" ON public.capex_uploads FOR UPDATE USING (false);
CREATE POLICY "no_direct_delete_capex_uploads" ON public.capex_uploads FOR DELETE USING (false);

CREATE POLICY "read_capex_records" ON public.capex_records FOR SELECT USING (true);
CREATE POLICY "no_direct_insert_capex_records" ON public.capex_records FOR INSERT WITH CHECK (false);
CREATE POLICY "no_direct_update_capex_records" ON public.capex_records FOR UPDATE USING (false);
CREATE POLICY "no_direct_delete_capex_records" ON public.capex_records FOR DELETE USING (false);

-- RPCs
DROP FUNCTION IF EXISTS public.insert_capex_batch CASCADE;
CREATE OR REPLACE FUNCTION public.insert_capex_batch(
  p_records JSONB,
  p_session_token TEXT,
  p_uploaded_by TEXT,
  p_file_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_upload_id UUID;
  v_count INTEGER;
  v_total_orc NUMERIC;
  v_total_real NUMERIC;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE session_token = p_session_token AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;
  IF v_session.tipo != 'ceo' THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM(CASE WHEN r->>'base' = 'orc' THEN (r->>'executado')::numeric ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r->>'base' = 'real' THEN (r->>'executado')::numeric ELSE 0 END), 0)
  INTO v_count, v_total_orc, v_total_real
  FROM jsonb_array_elements(p_records) AS r;

  INSERT INTO capex_uploads (uploaded_by, file_name, record_count, total_orcado, total_realizado)
  VALUES (p_uploaded_by, p_file_name, v_count, v_total_orc, v_total_real)
  RETURNING id INTO v_upload_id;

  INSERT INTO capex_records (
    upload_id, base, tipo, centro_custo, desc_centro_custo, area, diretoria,
    responsavel_area, nome_projeto, projeto_novo, sponsor_projeto,
    cod_fornecedor, razao_social, nome_fantasia, conta_contabil, desc_conta_contabil,
    grupo_pacotes, grupo_contas_1, grupo_contas_2, item_contabil,
    executado, mes_num, historico, data_lancamento, nf_numero, pedido_numero, desc_pedido
  )
  SELECT
    v_upload_id,
    r->>'base', r->>'tipo', r->>'centro_custo', r->>'desc_centro_custo',
    r->>'area', r->>'diretoria', r->>'responsavel_area',
    r->>'nome_projeto', r->>'projeto_novo', r->>'sponsor_projeto',
    r->>'cod_fornecedor', r->>'razao_social', r->>'nome_fantasia',
    r->>'conta_contabil', r->>'desc_conta_contabil',
    r->>'grupo_pacotes', r->>'grupo_contas_1', r->>'grupo_contas_2',
    r->>'item_contabil',
    COALESCE((r->>'executado')::numeric, 0),
    COALESCE((r->>'mes_num')::integer, 0),
    r->>'historico', r->>'data_lancamento', r->>'nf_numero',
    r->>'pedido_numero', r->>'desc_pedido'
  FROM jsonb_array_elements(p_records) AS r;

  RETURN jsonb_build_object('upload_id', v_upload_id, 'count', v_count);
END;
$$;

DROP FUNCTION IF EXISTS public.clear_capex_data CASCADE;
CREATE OR REPLACE FUNCTION public.clear_capex_data(p_session_token TEXT)
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
  DELETE FROM capex_records WHERE id IS NOT NULL;
  DELETE FROM capex_uploads WHERE id IS NOT NULL;
  RETURN true;
END;
$$;