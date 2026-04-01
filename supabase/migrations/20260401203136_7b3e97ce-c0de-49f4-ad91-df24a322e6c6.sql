ALTER TABLE opex_records ADD COLUMN IF NOT EXISTS decisao TEXT DEFAULT NULL;

CREATE OR REPLACE FUNCTION insert_opex_batch(p_records JSONB, p_session_token TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_session RECORD;
BEGIN
  SELECT * INTO v_session FROM active_sessions
  WHERE session_token = p_session_token AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  INSERT INTO opex_records (
    base, centro_custo, descricao_ccusto, area_grupo1, diretoria,
    responsavel_area, conta_contabil, descricao_conta, recurso, pacote,
    debito, credito, executado, mes, tipo, data_lcto, numero_lote,
    historico, nome_fornecedor, desc_pedido, fornecedor_gerencial,
    origem, descr_origem, agrupamento, decisao
  )
  SELECT
    r->>'base', r->>'centro_custo', r->>'descricao_ccusto',
    r->>'area_grupo1', r->>'diretoria', r->>'responsavel_area',
    r->>'conta_contabil', r->>'descricao_conta', r->>'recurso',
    r->>'pacote',
    (r->>'debito')::numeric, (r->>'credito')::numeric,
    (r->>'executado')::numeric, (r->>'mes')::integer,
    r->>'tipo', r->>'data_lcto', r->>'numero_lote',
    r->>'historico', r->>'nome_fornecedor', r->>'desc_pedido',
    r->>'fornecedor_gerencial',
    r->>'origem', r->>'descr_origem', r->>'agrupamento', r->>'decisao'
  FROM jsonb_array_elements(p_records) AS r;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;