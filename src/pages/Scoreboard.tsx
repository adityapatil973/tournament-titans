import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crosshair, Star, Medal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  free_fire_uid: string;
  team_name: string | null;
  matches_played: number;
  total_kills: number;
  total_rank_points: number;
  total_points: number;
  rank: number;
}

interface Tournament { id: string; name: string; }

export default function Scoreboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async (tId: string) => {
    let scoresQuery = supabase
      .from("scores")
      .select("player_id, match_id, kills, rank_points, total_points, players!inner(player_name, free_fire_uid, team_name, tournament_id)");

    if (tId !== "all") {
      scoresQuery = scoresQuery.eq("players.tournament_id", tId);
    }

    const { data: scores, error } = await scoresQuery;
    if (error) { console.error("Leaderboard fetch error:", error); setLoading(false); return; }

    const aggregated: Record<string, LeaderboardEntry & { match_set: Set<string> }> = {};
    (scores || []).forEach((s: any) => {
      const p = s.players;
      if (!p) return;
      if (!aggregated[s.player_id]) {
        aggregated[s.player_id] = {
          player_id: s.player_id,
          player_name: p.player_name || "Unknown",
          free_fire_uid: p.free_fire_uid || "—",
          team_name: p.team_name || null,
          matches_played: 0,
          total_kills: 0,
          total_rank_points: 0,
          total_points: 0,
          rank: 0,
          match_set: new Set<string>(),
        };
      }
      const e = aggregated[s.player_id];
      e.total_kills += s.kills || 0;
      e.total_rank_points += s.rank_points || 0;
      e.total_points += s.total_points || 0;
      if (s.match_id) e.match_set.add(s.match_id);
    });

    const sorted = Object.values(aggregated)
      .map((e) => ({ ...e, matches_played: e.match_set.size }))
      .sort((a, b) => b.total_points - a.total_points || b.total_kills - a.total_kills)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    setLeaderboard(sorted);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from("tournaments").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => setTournaments(data || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard(tournamentId);

    const channel = supabase
      .channel(`scoreboard-realtime-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, () => fetchLeaderboard(tournamentId))
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchLeaderboard(tournamentId))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]);

  const medalColor = (i: number) =>
    i === 0 ? "text-neon-yellow" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-neon-red" : "";

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-glow-blue uppercase">Live Scoreboard</h1>
            <p className="text-muted-foreground font-heading text-sm">Updates in real-time after every match</p>
          </div>
          <Select value={tournamentId} onValueChange={setTournamentId}>
            <SelectTrigger className="w-full sm:w-64 bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tournaments</SelectItem>
              {tournaments.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-20">Loading leaderboard...</div>
        ) : leaderboard.length === 0 ? (
          <div className="card-gaming p-12 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No scores recorded yet</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block card-gaming overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-heading uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/20">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-2">UID</div>
                <div className="col-span-1 text-center">M</div>
                <div className="col-span-1 text-center">Kills</div>
                <div className="col-span-1 text-center">Rank Pts</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              <AnimatePresence initial={false}>
                {leaderboard.map((entry, i) => (
                  <motion.div
                    key={entry.player_id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
                    className={`grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-border/50 last:border-0 ${
                      i < 3 ? "bg-primary/5" : "hover:bg-muted/20"
                    }`}
                  >
                    <div className="col-span-1 flex items-center gap-1">
                      {i < 3 ? (
                        <Medal className={`w-5 h-5 ${medalColor(i)} fill-current`} />
                      ) : (
                        <span className="font-display text-sm text-muted-foreground">#{entry.rank}</span>
                      )}
                    </div>
                    <div className="col-span-4 min-w-0">
                      <div className="font-heading font-semibold truncate">{entry.player_name}</div>
                      {entry.team_name && <div className="text-xs text-muted-foreground truncate">{entry.team_name}</div>}
                    </div>
                    <div className="col-span-2 font-mono text-xs text-muted-foreground truncate">{entry.free_fire_uid}</div>
                    <div className="col-span-1 text-center font-display text-sm">{entry.matches_played}</div>
                    <div className="col-span-1 text-center flex items-center justify-center gap-1">
                      <Crosshair className="w-3 h-3 text-neon-red" />
                      <span className="font-display text-sm">{entry.total_kills}</span>
                    </div>
                    <div className="col-span-1 text-center font-display text-sm text-neon-purple">{entry.total_rank_points}</div>
                    <div className="col-span-2 text-right font-display text-lg font-bold text-primary text-glow-blue">{entry.total_points}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              <AnimatePresence initial={false}>
                {leaderboard.map((entry, i) => (
                  <motion.div
                    key={entry.player_id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`card-gaming p-3 ${i < 3 ? "border-primary/30" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {i < 3 ? (
                          <Star className={`w-5 h-5 shrink-0 ${medalColor(i)} fill-current`} />
                        ) : (
                          <span className="font-display text-sm text-muted-foreground w-5 text-center">#{entry.rank}</span>
                        )}
                        <div className="min-w-0">
                          <div className="font-heading font-semibold truncate">{entry.player_name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground truncate">UID {entry.free_fire_uid}</div>
                        </div>
                      </div>
                      <div className="font-display text-xl font-bold text-primary text-glow-blue shrink-0">{entry.total_points}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
                      <div className="bg-muted/30 rounded py-1">
                        <div className="text-[10px] text-muted-foreground uppercase">Matches</div>
                        <div className="font-display">{entry.matches_played}</div>
                      </div>
                      <div className="bg-muted/30 rounded py-1">
                        <div className="text-[10px] text-muted-foreground uppercase">Kills</div>
                        <div className="font-display text-neon-red">{entry.total_kills}</div>
                      </div>
                      <div className="bg-muted/30 rounded py-1">
                        <div className="text-[10px] text-muted-foreground uppercase">Rank Pts</div>
                        <div className="font-display text-neon-purple">{entry.total_rank_points}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
