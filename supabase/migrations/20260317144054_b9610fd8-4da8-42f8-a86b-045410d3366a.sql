
-- Lock down active_sessions: insert/delete only via SECURITY DEFINER functions
DROP POLICY IF EXISTS "public_insert_session" ON active_sessions;
DROP POLICY IF EXISTS "public_delete_session" ON active_sessions;

CREATE POLICY "no_direct_insert_session" ON active_sessions FOR INSERT WITH CHECK (false);
CREATE POLICY "no_direct_delete_session" ON active_sessions FOR DELETE USING (false);

-- Create logout function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION destroy_session(p_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM active_sessions WHERE session_token = p_session_token;
  RETURN true;
END;
$$;
