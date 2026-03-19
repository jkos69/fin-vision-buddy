ALTER TABLE opex_records ADD COLUMN IF NOT EXISTS agrupamento TEXT;

CREATE OR REPLACE FUNCTION public.insert_opex_batch(p_session_token text, p_records jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
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
    historico, nome_fornecedor, desc_pedido, fornecedor_gerencial, origem, descr_origem, agrupamento
  )
  SELECT
    (r->>'upload_id')::UUID,
    r->>'base', r->>'centro_custo', r->>'descricao_ccusto', r->>'area_grupo1', r->>'diretoria',
    r->>'responsavel_area', r->>'conta_contabil', r->>'descricao_conta', r->>'recurso', r->>'pacote',
    (r->>'debito')::NUMERIC, (r->>'credito')::NUMERIC, (r->>'executado')::NUMERIC,
    (r->>'mes')::INTEGER, r->>'tipo', r->>'data_lcto', r->>'numero_lote',
    r->>'historico', r->>'nome_fornecedor', r->>'desc_pedido', r->>'fornecedor_gerencial',
    r->>'origem', r->>'descr_origem', r->>'agrupamento'
  FROM jsonb_array_elements(p_records) AS r;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;