
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create tournament status enum
CREATE TYPE public.tournament_status AS ENUM ('upcoming', 'live', 'completed');

-- Create payment status enum  
CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected');

-- Create match status enum
CREATE TYPE public.match_status AS ENUM ('scheduled', 'live', 'completed');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  prize_pool INTEGER NOT NULL DEFAULT 0,
  max_players INTEGER NOT NULL DEFAULT 100,
  rules TEXT,
  youtube_live_url TEXT,
  whatsapp_link TEXT,
  telegram_link TEXT,
  upi_id TEXT,
  status tournament_status NOT NULL DEFAULT 'upcoming',
  start_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  player_name TEXT NOT NULL,
  free_fire_uid TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  payment_screenshot_url TEXT,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  player_id_code TEXT NOT NULL,
  anti_cheat_accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tournament_id)
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  match_number INTEGER NOT NULL,
  room_id TEXT,
  room_password TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  reveal_time TIMESTAMP WITH TIME ZONE,
  status match_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Match players (assign players to matches)
CREATE TABLE public.match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(match_id, player_id)
);
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;

-- Scores table
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  kills INTEGER NOT NULL DEFAULT 0,
  rank_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', true);

-- RLS Policies

-- User roles: users can read their own role, admins can manage all
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Tournaments: public read, admin write
CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins can manage tournaments" ON public.tournaments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Players: users can see own, admins can see all
CREATE POLICY "Users can view own registrations" ON public.players FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can register" ON public.players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all players" ON public.players FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage players" ON public.players FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Matches: public read, admin write
CREATE POLICY "Matches are viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admins can manage matches" ON public.matches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Match players: public read, admin write
CREATE POLICY "Match players viewable by everyone" ON public.match_players FOR SELECT USING (true);
CREATE POLICY "Admins can manage match players" ON public.match_players FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Scores: public read, admin write
CREATE POLICY "Scores are viewable by everyone" ON public.scores FOR SELECT USING (true);
CREATE POLICY "Admins can manage scores" ON public.scores FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Announcements: public read, admin write
CREATE POLICY "Announcements viewable by everyone" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Storage policies
CREATE POLICY "Anyone can view payment screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'payment-screenshots');
CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-screenshots' AND auth.role() = 'authenticated');

-- Auto-assign user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
