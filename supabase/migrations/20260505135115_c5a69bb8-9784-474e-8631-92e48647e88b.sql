
INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-assets', 'tournament-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tournament assets are public"
ON storage.objects FOR SELECT
USING (bucket_id = 'tournament-assets');

CREATE POLICY "Admins can manage tournament assets"
ON storage.objects FOR ALL
USING (bucket_id = 'tournament-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'tournament-assets' AND public.has_role(auth.uid(), 'admin'));
