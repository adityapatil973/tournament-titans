
-- 1. Make payment-screenshots bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-screenshots';

-- Replace storage policies
DROP POLICY IF EXISTS "Anyone can view payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload screenshots" ON storage.objects;

CREATE POLICY "Users can view own payment screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-screenshots'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Users can upload own payment screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own payment screenshots"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners and admins can delete payment screenshots"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-screenshots'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- 2. Restrict sensitive columns on matches via column-level privileges
REVOKE SELECT ON public.matches FROM anon, authenticated;
GRANT SELECT (id, tournament_id, match_number, status, scheduled_at, reveal_time, created_at, updated_at)
  ON public.matches TO anon, authenticated;
-- Admins still need full access; service role bypasses RLS already, but grant for completeness
GRANT SELECT ON public.matches TO service_role;

-- Secure RPC for players to fetch their own room credentials after reveal
CREATE OR REPLACE FUNCTION public.get_match_credentials(_match_id uuid)
RETURNS TABLE(room_id text, room_password text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN QUERY SELECT m.room_id, m.room_password FROM public.matches m WHERE m.id = _match_id;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.room_id, m.room_password
  FROM public.matches m
  JOIN public.match_players mp ON mp.match_id = m.id
  JOIN public.players p ON p.id = mp.player_id
  WHERE m.id = _match_id
    AND p.user_id = auth.uid()
    AND m.reveal_time IS NOT NULL
    AND now() >= m.reveal_time;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_match_credentials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_credentials(uuid) TO authenticated;

-- 3. Restrict tournament UPI ID to authenticated users
REVOKE SELECT ON public.tournaments FROM anon, authenticated;
GRANT SELECT (id, name, description, entry_fee, prize_pool, max_players, status, start_date,
              qr_code_url, rules, telegram_link, whatsapp_link, youtube_live_url,
              created_at, updated_at)
  ON public.tournaments TO anon;
GRANT SELECT ON public.tournaments TO authenticated;
GRANT SELECT ON public.tournaments TO service_role;

-- 4. Tighten SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
