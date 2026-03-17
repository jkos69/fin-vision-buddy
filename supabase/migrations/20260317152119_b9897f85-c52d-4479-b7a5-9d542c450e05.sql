
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recreate create_session to use extensions.crypt
CREATE OR REPLACE FUNCTION public.create_session(input_senha text)
RETURNS TABLE(session_token text, tipo text, diretoria text, area text, responsavel text, nome_display text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token TEXT;
  v_result RECORD;
BEGIN
  SELECT ap.id, ap.tipo, ap.diretoria, ap.area, ap.responsavel, ap.nome_display
  INTO v_result
  FROM access_passwords ap
  WHERE ap.senha_hash = extensions.crypt(input_senha, ap.senha_hash);

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

-- Re-hash all passwords using extensions.crypt
UPDATE access_passwords SET senha_hash = extensions.crypt(senha, extensions.gen_salt('bf'));
