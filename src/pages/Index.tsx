import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Users, Calendar, DollarSign, Youtube, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import CountdownTimer from "@/components/CountdownTimer";
import heroBanner from "@/assets/hero-banner.jpg";

type Tournament = {
  id: string;
  name: string;
  description: string | null;
  entry_fee: number;
  prize_pool: number;
  max_players: number;
  rules: string | null;
  youtube_live_url: string | null;
  whatsapp_link: string | null;
  telegram_link: string | null;
  status: string;
  start_date: string | null;
};

export default function Index() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    const fetchTournament = async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setTournament(data);
        const { count } = await supabase
          .from("players")
          .select("*", { count: "exact", head: true })
          .eq("tournament_id", data.id);
        setPlayerCount(count ?? 0);
      }
    };
    fetchTournament();
  }, []);

  return (
    <div className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative h-[80vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBanner} alt="Free Fire Tournament" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center px-4 max-w-4xl"
        >
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-black uppercase tracking-wider text-glow-blue mb-4">
            {tournament?.name || "Free Fire Solo Tournament"}
          </h1>
          <p className="font-heading text-xl md:text-2xl text-muted-foreground mb-8">
            {tournament?.description || "Battle. Survive. Win Big."}
          </p>

          {tournament?.start_date && (
            <div className="flex justify-center mb-8">
              <CountdownTimer targetDate={tournament.start_date} />
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="btn-neon px-10 py-6 text-lg rounded-lg text-primary-foreground font-heading uppercase tracking-wider">
                Register Now
              </Button>
            </Link>
            <Link to="/scoreboard">
              <Button size="lg" variant="outline" className="px-10 py-6 text-lg rounded-lg border-primary/30 hover:border-primary font-heading uppercase tracking-wider">
                Scoreboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4">
        <div className="container mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Trophy, label: "Prize Pool", value: `₹${tournament?.prize_pool || 0}`, color: "text-neon-yellow" },
            { icon: DollarSign, label: "Entry Fee", value: `₹${tournament?.entry_fee || 0}`, color: "text-neon-green" },
            { icon: Users, label: "Registered", value: `${playerCount}/${tournament?.max_players || 100}`, color: "text-neon-blue" },
            { icon: Calendar, label: "Status", value: tournament?.status?.toUpperCase() || "UPCOMING", color: "text-neon-purple" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="card-gaming p-6 text-center"
            >
              <stat.icon className={`w-8 h-8 mx-auto mb-3 ${stat.color}`} />
              <div className={`font-display text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-muted-foreground font-heading uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Rules */}
      {tournament?.rules && (
        <section className="py-16 px-4 bg-gradient-gaming">
          <div className="container mx-auto max-w-3xl">
            <h2 className="font-display text-3xl font-bold text-center mb-8 text-glow-blue uppercase">Tournament Rules</h2>
            <div className="card-gaming p-8">
              <pre className="whitespace-pre-wrap font-body text-muted-foreground leading-relaxed">{tournament.rules}</pre>
            </div>
          </div>
        </section>
      )}

      {/* YouTube Live */}
      {tournament?.youtube_live_url && (
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-4xl">
            <h2 className="font-display text-3xl font-bold text-center mb-8 text-glow-purple uppercase flex items-center justify-center gap-3">
              <Youtube className="w-8 h-8 text-neon-red" /> Live Stream
            </h2>
            <div className="card-gaming overflow-hidden aspect-video">
              <iframe
                src={tournament.youtube_live_url.replace("watch?v=", "embed/")}
                className="w-full h-full"
                allowFullScreen
                title="Live Stream"
              />
            </div>
          </div>
        </section>
      )}

      {/* Social Links */}
      <section className="py-16 px-4">
        <div className="container mx-auto flex flex-wrap justify-center gap-4">
          {tournament?.whatsapp_link && (
            <a href={tournament.whatsapp_link} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-neon-green text-primary-foreground gap-2 font-heading uppercase tracking-wider rounded-lg hover:opacity-90">
                <MessageCircle className="w-5 h-5" /> Join WhatsApp Group
              </Button>
            </a>
          )}
          {tournament?.telegram_link && (
            <a href={tournament.telegram_link} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-neon-blue text-primary-foreground gap-2 font-heading uppercase tracking-wider rounded-lg hover:opacity-90">
                <Send className="w-5 h-5" /> Join Telegram
              </Button>
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-muted-foreground text-sm">
        <p className="font-heading">© 2026 FF Arena. All rights reserved.</p>
      </footer>
    </div>
  );
}
