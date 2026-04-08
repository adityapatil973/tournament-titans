import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Crosshair, TrendingUp, Target, BarChart3, Swords } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface MatchScore {
  match_number: number;
  kills: number;
  rank_points: number;
  total_points: number;
  match_status: string;
  scheduled_at: string | null;
}

interface PlayerProfile {
  player_name: string;
  player_id_code: string;
  free_fire_uid: string;
}

export default function PlayerStats() {
  const { user } = useAuth();
  const [scores, setScores] = useState<MatchScore[]>([]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    // Get player profile
    const { data: playerData } = await supabase
      .from("players")
      .select("id, player_name, player_id_code, free_fire_uid")
      .eq("user_id", user!.id)
      .limit(1)
      .maybeSingle();

    if (!playerData) { setLoading(false); return; }

    setProfile({
      player_name: playerData.player_name,
      player_id_code: playerData.player_id_code,
      free_fire_uid: playerData.free_fire_uid,
    });

    // Get all scores with match info
    const { data: scoreData } = await supabase
      .from("scores")
      .select("kills, rank_points, total_points, matches(match_number, status, scheduled_at)")
      .eq("player_id", playerData.id)
      .order("created_at");

    if (scoreData) {
      const mapped: MatchScore[] = scoreData.map((s: any) => ({
        match_number: s.matches?.match_number || 0,
        kills: s.kills,
        rank_points: s.rank_points,
        total_points: s.total_points,
        match_status: s.matches?.status || "unknown",
        scheduled_at: s.matches?.scheduled_at,
      }));
      mapped.sort((a, b) => a.match_number - b.match_number);
      setScores(mapped);
    }
    setLoading(false);
  };

  const totalKills = scores.reduce((s, m) => s + m.kills, 0);
  const totalRankPts = scores.reduce((s, m) => s + m.rank_points, 0);
  const totalPoints = scores.reduce((s, m) => s + m.total_points, 0);
  const avgKills = scores.length ? (totalKills / scores.length).toFixed(1) : "0";
  const bestMatch = scores.length ? Math.max(...scores.map(s => s.total_points)) : 0;

  const chartData = scores.map(s => ({
    name: `M${s.match_number}`,
    kills: s.kills,
    rankPts: s.rank_points,
    total: s.total_points,
  }));

  if (!user) {
    return (
      <div className="min-h-screen pt-20 pb-10 px-4 flex items-center justify-center">
        <div className="card-gaming p-12 text-center">
          <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground font-heading">Please log in to view your stats</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="container mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-bold text-center mb-2 text-glow-purple uppercase">Player Statistics</h1>
        <p className="text-center text-muted-foreground mb-8 font-heading">Your performance overview</p>

        {loading ? (
          <div className="text-center text-muted-foreground py-20">Loading...</div>
        ) : !profile ? (
          <div className="card-gaming p-12 text-center">
            <Swords className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground font-heading">No tournament registration found. Register first!</p>
          </div>
        ) : (
          <>
            {/* Player Info */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-gaming p-6 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <Target className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">{profile.player_name}</h2>
                  <p className="text-xs text-muted-foreground font-heading">
                    ID: {profile.player_id_code} · UID: {profile.free_fire_uid}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Kills", value: totalKills, icon: Crosshair, color: "text-neon-red" },
                { label: "Total Points", value: totalPoints, icon: Trophy, color: "text-primary" },
                { label: "Avg Kills/Match", value: avgKills, icon: TrendingUp, color: "text-neon-green" },
                { label: "Best Match", value: bestMatch, icon: BarChart3, color: "text-neon-yellow" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="card-gaming p-4 text-center"
                >
                  <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                  <div className="font-display text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground font-heading uppercase mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {scores.length > 0 && (
              <>
                {/* Points Trend Chart */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-gaming p-6 mb-6">
                  <h3 className="font-heading text-lg font-semibold uppercase mb-4">Points Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} name="Total Points" />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Kills per Match Bar Chart */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card-gaming p-6 mb-6">
                  <h3 className="font-heading text-lg font-semibold uppercase mb-4">Kills Per Match</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Bar dataKey="kills" fill="hsl(0 90% 60%)" radius={[4, 4, 0, 0]} name="Kills" />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Match History Table */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card-gaming p-6">
                  <h3 className="font-heading text-lg font-semibold uppercase mb-4">Match History</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-heading uppercase tracking-wider text-muted-foreground">
                      <div>Match</div>
                      <div className="text-center">Kills</div>
                      <div className="text-center">Rank Pts</div>
                      <div className="text-center">Total</div>
                    </div>
                    {scores.map((s, i) => (
                      <div key={i} className="grid grid-cols-4 gap-2 px-3 py-3 rounded-lg bg-muted/30 items-center">
                        <div className="font-heading text-sm">Match #{s.match_number}</div>
                        <div className="text-center font-display text-sm flex items-center justify-center gap-1">
                          <Crosshair className="w-3 h-3 text-neon-red" />
                          {s.kills}
                        </div>
                        <div className="text-center font-display text-sm text-neon-purple">{s.rank_points}</div>
                        <div className="text-center font-display text-sm font-bold text-primary">{s.total_points}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}

            {scores.length === 0 && (
              <div className="card-gaming p-12 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground font-heading">No match data yet. Play some matches to see your stats!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
