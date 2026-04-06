import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Crosshair, Star } from "lucide-react";

interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  total_kills: number;
  total_rank_points: number;
  total_points: number;
}

export default function Scoreboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboard = async () => {
    const { data: scores } = await supabase
      .from("scores")
      .select("player_id, kills, rank_points, total_points, players(player_name)");

    if (scores) {
      const aggregated: Record<string, LeaderboardEntry> = {};
      scores.forEach((s: any) => {
        if (!aggregated[s.player_id]) {
          aggregated[s.player_id] = {
            player_id: s.player_id,
            player_name: s.players?.player_name || "Unknown",
            total_kills: 0,
            total_rank_points: 0,
            total_points: 0,
          };
        }
        aggregated[s.player_id].total_kills += s.kills;
        aggregated[s.player_id].total_rank_points += s.rank_points;
        aggregated[s.player_id].total_points += s.total_points;
      });
      const sorted = Object.values(aggregated).sort((a, b) => b.total_points - a.total_points);
      setLeaderboard(sorted);
    }
    setLoading(false);
  };

  const medalColors = ["text-neon-yellow", "text-muted-foreground", "text-neon-red"];

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-bold text-center mb-2 text-glow-blue uppercase">Live Scoreboard</h1>
        <p className="text-center text-muted-foreground mb-8 font-heading">Auto-refreshes every 30 seconds</p>

        {loading ? (
          <div className="text-center text-muted-foreground py-20">Loading...</div>
        ) : leaderboard.length === 0 ? (
          <div className="card-gaming p-12 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No scores recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-heading uppercase tracking-wider text-muted-foreground">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-center">Kills</div>
              <div className="col-span-2 text-center">Rank Pts</div>
              <div className="col-span-2 text-center">Total</div>
            </div>

            {leaderboard.map((entry, i) => (
              <motion.div
                key={entry.player_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`grid grid-cols-12 gap-2 items-center px-4 py-4 rounded-lg ${
                  i < 3 ? "card-gaming border-primary/20" : "bg-muted/30"
                }`}
              >
                <div className="col-span-1">
                  {i < 3 ? (
                    <Star className={`w-5 h-5 ${medalColors[i]} fill-current`} />
                  ) : (
                    <span className="font-display text-sm text-muted-foreground">{i + 1}</span>
                  )}
                </div>
                <div className="col-span-5 font-heading font-semibold truncate">
                  {entry.player_name}
                </div>
                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                  <Crosshair className="w-3 h-3 text-neon-red" />
                  <span className="font-display text-sm">{entry.total_kills}</span>
                </div>
                <div className="col-span-2 text-center font-display text-sm text-neon-purple">
                  {entry.total_rank_points}
                </div>
                <div className="col-span-2 text-center font-display text-lg font-bold text-primary text-glow-blue">
                  {entry.total_points}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
