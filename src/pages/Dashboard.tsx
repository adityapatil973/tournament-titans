import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Clock, Trophy, Bell, Key, Shield } from "lucide-react";

function RoomCredentials({ matchId }: { matchId: string }) {
  const [creds, setCreds] = useState<{ room_id: string | null; room_password: string | null } | null>(null);
  useEffect(() => {
    supabase.rpc("get_match_credentials", { _match_id: matchId }).then(({ data }) => {
      if (data && data[0]) setCreds(data[0]);
    });
  }, [matchId]);
  if (!creds || !creds.room_id) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Key className="w-4 h-4 text-neon-yellow" />
      <span>Room: <code className="text-primary">{creds.room_id}</code></span>
      <span>Pass: <code className="text-primary">{creds.room_password}</code></span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchData();
    const channel = supabase
      .channel("dashboard-player-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const { data: player } = await supabase
      .from("players")
      .select("*, tournaments(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRegistration(player);

    if (player) {
      const { data: matchPlayers } = await supabase
        .from("match_players")
        .select("match_id, matches(*)")
        .eq("player_id", player.id);
      setMatches(matchPlayers?.map((mp: any) => mp.matches) || []);

      const { data: scoreData } = await supabase
        .from("scores")
        .select("*")
        .eq("player_id", player.id);
      setScores(scoreData || []);

      const { data: ann } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      setAnnouncements(ann || []);
    }
  };

  const statusColor: Record<string, string> = {
    pending: "bg-neon-yellow/20 text-neon-yellow border-neon-yellow/30",
    approved: "bg-neon-green/20 text-neon-green border-neon-green/30",
    rejected: "bg-neon-red/20 text-neon-red border-neon-red/30",
  };

  const isRoomRevealed = (match: any) => {
    if (!match.reveal_time) return false;
    return new Date() >= new Date(match.reveal_time);
  };

  const totalPoints = scores.reduce((sum, s) => sum + s.total_points, 0);
  const totalKills = scores.reduce((sum, s) => sum + s.kills, 0);

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="container mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-bold mb-8 text-glow-blue uppercase">Player Dashboard</h1>

        {!registration ? (
          <div className="card-gaming p-8 text-center">
            <p className="text-muted-foreground mb-4">You haven't registered for any tournament yet.</p>
            <a href="/register" className="text-primary hover:underline font-heading uppercase">Register Now →</a>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Registration Status */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-gaming p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-heading text-lg font-semibold uppercase">Registration</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Player ID</span>
                  <span className="font-mono text-primary">{registration.player_id_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{registration.player_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">FF UID</span>
                  <span className="font-mono">{registration.free_fire_uid}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Payment</span>
                  <Badge className={`${statusColor[registration.payment_status]} border`}>
                    {registration.payment_status}
                  </Badge>
                </div>
                {registration.payment_status === "rejected" && registration.rejection_reason && (
                  <div className="text-xs text-neon-red border border-neon-red/30 rounded p-2 bg-neon-red/5">
                    <span className="font-heading uppercase">Rejection reason:</span> {registration.rejection_reason}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-gaming p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-neon-yellow" />
                <h2 className="font-heading text-lg font-semibold uppercase">Your Stats</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="font-display text-3xl font-bold text-neon-green">{totalKills}</div>
                  <div className="text-xs text-muted-foreground uppercase">Total Kills</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-3xl font-bold text-neon-purple">{totalPoints}</div>
                  <div className="text-xs text-muted-foreground uppercase">Total Points</div>
                </div>
                <div className="text-center col-span-2">
                  <div className="font-display text-3xl font-bold text-primary">{scores.length}</div>
                  <div className="text-xs text-muted-foreground uppercase">Matches Played</div>
                </div>
              </div>
            </motion.div>

            {/* Announcements */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-gaming p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-neon-red" />
                <h2 className="font-heading text-lg font-semibold uppercase">Announcements</h2>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-gaming">
                {announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No announcements yet</p>
                ) : (
                  announcements.map((a) => (
                    <div key={a.id} className="border-l-2 border-primary pl-3">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.message}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Match Schedule */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-3 card-gaming p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary" />
                <h2 className="font-heading text-lg font-semibold uppercase">Match Schedule</h2>
              </div>
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches scheduled yet</p>
              ) : (
                <div className="space-y-3">
                  {matches.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <span className="font-heading font-semibold">Match #{m.match_number}</span>
                        <p className="text-xs text-muted-foreground">
                          {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "TBD"}
                        </p>
                      </div>
                      <Badge className={m.status === "live" ? "bg-neon-green/20 text-neon-green" : "bg-muted text-muted-foreground"}>
                        {m.status}
                      </Badge>
                      {isRoomRevealed(m) && (
                        <RoomCredentials matchId={m.id} />
                      )}
                      {!isRoomRevealed(m) && (
                        <span className="text-xs text-muted-foreground">Room ID reveals before match</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
