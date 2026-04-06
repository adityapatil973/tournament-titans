import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Gamepad2, BarChart3, Megaphone, Plus, Check, X, Download } from "lucide-react";

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("players");

  // Tournament form
  const [tournamentForm, setTournamentForm] = useState({
    name: "", description: "", entry_fee: 0, prize_pool: 0, max_players: 100,
    rules: "", youtube_live_url: "", whatsapp_link: "", telegram_link: "", upi_id: "",
    start_date: "",
  });

  // Match form
  const [matchForm, setMatchForm] = useState({
    tournament_id: "", match_number: 1, room_id: "", room_password: "",
    scheduled_at: "", reveal_time: "",
  });

  // Score form
  const [scoreForm, setScoreForm] = useState({ match_id: "", player_id: "", kills: 0, rank_points: 0 });

  // Announcement form
  const [annForm, setAnnForm] = useState({ title: "", message: "", tournament_id: "" });

  useEffect(() => {
    if (!user || !isAdmin) { navigate("/"); return; }
    fetchAll();
  }, [user, isAdmin]);

  const fetchAll = async () => {
    const [{ data: p }, { data: m }, { data: t }] = await Promise.all([
      supabase.from("players").select("*").order("created_at", { ascending: false }),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
    ]);
    setPlayers(p || []);
    setMatches(m || []);
    setTournaments(t || []);
    if (t?.[0]) {
      setMatchForm((f) => ({ ...f, tournament_id: t[0].id }));
      setAnnForm((f) => ({ ...f, tournament_id: t[0].id }));
    }
  };

  const updatePaymentStatus = async (playerId: string, status: string) => {
    const { error } = await supabase.from("players").update({ payment_status: status as any }).eq("id", playerId);
    if (error) toast.error(error.message);
    else { toast.success(`Payment ${status}`); fetchAll(); }
  };

  const createTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("tournaments").insert({
      ...tournamentForm,
      start_date: tournamentForm.start_date || null,
      youtube_live_url: tournamentForm.youtube_live_url || null,
      whatsapp_link: tournamentForm.whatsapp_link || null,
      telegram_link: tournamentForm.telegram_link || null,
      upi_id: tournamentForm.upi_id || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Tournament created!"); fetchAll(); }
  };

  const createMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("matches").insert({
      ...matchForm,
      scheduled_at: matchForm.scheduled_at || null,
      reveal_time: matchForm.reveal_time || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Match created!"); fetchAll(); }
  };

  const addScore = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = scoreForm.kills + scoreForm.rank_points;
    const { error } = await supabase.from("scores").insert({
      ...scoreForm,
      total_points: total,
    });
    if (error) toast.error(error.message);
    else { toast.success("Score added!"); setScoreForm({ match_id: "", player_id: "", kills: 0, rank_points: 0 }); }
  };

  const sendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("announcements").insert({
      title: annForm.title,
      message: annForm.message,
      tournament_id: annForm.tournament_id || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Announcement sent!"); setAnnForm({ ...annForm, title: "", message: "" }); }
  };

  const downloadResults = () => {
    const csv = ["Player Name,FF UID,Kills,Rank Points,Total Points"];
    // This would need scores joined with players - simplified version
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.click();
  };

  const statusColor: Record<string, string> = {
    pending: "bg-neon-yellow/20 text-neon-yellow border-neon-yellow/30",
    approved: "bg-neon-green/20 text-neon-green border-neon-green/30",
    rejected: "bg-neon-red/20 text-neon-red border-neon-red/30",
  };

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="font-display text-3xl font-bold mb-8 text-glow-purple uppercase">Admin Panel</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted border border-border mb-8 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="players" className="gap-2 font-heading uppercase text-xs"><Users className="w-4 h-4" />Players</TabsTrigger>
            <TabsTrigger value="tournament" className="gap-2 font-heading uppercase text-xs"><Plus className="w-4 h-4" />Tournament</TabsTrigger>
            <TabsTrigger value="matches" className="gap-2 font-heading uppercase text-xs"><Gamepad2 className="w-4 h-4" />Matches</TabsTrigger>
            <TabsTrigger value="scores" className="gap-2 font-heading uppercase text-xs"><BarChart3 className="w-4 h-4" />Scores</TabsTrigger>
            <TabsTrigger value="announce" className="gap-2 font-heading uppercase text-xs"><Megaphone className="w-4 h-4" />Broadcast</TabsTrigger>
          </TabsList>

          {/* PLAYERS */}
          <TabsContent value="players">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-xl font-semibold uppercase">Registered Players ({players.length})</h2>
              <Button size="sm" variant="outline" onClick={downloadResults} className="gap-2">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>
            <div className="space-y-3">
              {players.map((p) => (
                <div key={p.id} className="card-gaming p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-heading font-semibold">{p.player_name}</div>
                    <div className="text-xs text-muted-foreground space-x-3">
                      <span>UID: {p.free_fire_uid}</span>
                      <span>Phone: {p.phone}</span>
                      <span>ID: {p.player_id_code}</span>
                    </div>
                  </div>
                  <Badge className={`${statusColor[p.payment_status]} border`}>{p.payment_status}</Badge>
                  {p.payment_screenshot_url && (
                    <a href={p.payment_screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      View Screenshot
                    </a>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(p.id, "approved")} className="gap-1 text-neon-green border-neon-green/30 hover:bg-neon-green/10">
                      <Check className="w-3 h-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(p.id, "rejected")} className="gap-1 text-neon-red border-neon-red/30 hover:bg-neon-red/10">
                      <X className="w-3 h-3" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
              {players.length === 0 && <p className="text-muted-foreground text-center py-8">No players registered yet</p>}
            </div>
          </TabsContent>

          {/* TOURNAMENT */}
          <TabsContent value="tournament">
            <h2 className="font-heading text-xl font-semibold uppercase mb-4">Create Tournament</h2>
            <form onSubmit={createTournament} className="card-gaming p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Name</label>
                  <Input value={tournamentForm.name} onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })} required className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Start Date</label>
                  <Input type="datetime-local" value={tournamentForm.start_date} onChange={(e) => setTournamentForm({ ...tournamentForm, start_date: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Entry Fee (₹)</label>
                  <Input type="number" value={tournamentForm.entry_fee} onChange={(e) => setTournamentForm({ ...tournamentForm, entry_fee: parseInt(e.target.value) })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Prize Pool (₹)</label>
                  <Input type="number" value={tournamentForm.prize_pool} onChange={(e) => setTournamentForm({ ...tournamentForm, prize_pool: parseInt(e.target.value) })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Max Players</label>
                  <Input type="number" value={tournamentForm.max_players} onChange={(e) => setTournamentForm({ ...tournamentForm, max_players: parseInt(e.target.value) })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">UPI ID</label>
                  <Input value={tournamentForm.upi_id} onChange={(e) => setTournamentForm({ ...tournamentForm, upi_id: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">YouTube Live URL</label>
                  <Input value={tournamentForm.youtube_live_url} onChange={(e) => setTournamentForm({ ...tournamentForm, youtube_live_url: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">WhatsApp Group Link</label>
                  <Input value={tournamentForm.whatsapp_link} onChange={(e) => setTournamentForm({ ...tournamentForm, whatsapp_link: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Telegram Link</label>
                  <Input value={tournamentForm.telegram_link} onChange={(e) => setTournamentForm({ ...tournamentForm, telegram_link: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-heading uppercase text-muted-foreground">Description</label>
                <Textarea value={tournamentForm.description} onChange={(e) => setTournamentForm({ ...tournamentForm, description: e.target.value })} className="bg-muted border-border mt-1" />
              </div>
              <div>
                <label className="text-xs font-heading uppercase text-muted-foreground">Rules</label>
                <Textarea value={tournamentForm.rules} onChange={(e) => setTournamentForm({ ...tournamentForm, rules: e.target.value })} rows={5} className="bg-muted border-border mt-1" />
              </div>
              <Button type="submit" className="btn-neon rounded-md text-primary-foreground font-heading uppercase tracking-wider">Create Tournament</Button>
            </form>
          </TabsContent>

          {/* MATCHES */}
          <TabsContent value="matches">
            <h2 className="font-heading text-xl font-semibold uppercase mb-4">Create Match</h2>
            <form onSubmit={createMatch} className="card-gaming p-6 space-y-4 mb-8">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Tournament</label>
                  <select value={matchForm.tournament_id} onChange={(e) => setMatchForm({ ...matchForm, tournament_id: e.target.value })} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm mt-1">
                    {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Match Number</label>
                  <Input type="number" value={matchForm.match_number} onChange={(e) => setMatchForm({ ...matchForm, match_number: parseInt(e.target.value) })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Room ID</label>
                  <Input value={matchForm.room_id} onChange={(e) => setMatchForm({ ...matchForm, room_id: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Room Password</label>
                  <Input value={matchForm.room_password} onChange={(e) => setMatchForm({ ...matchForm, room_password: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Scheduled At</label>
                  <Input type="datetime-local" value={matchForm.scheduled_at} onChange={(e) => setMatchForm({ ...matchForm, scheduled_at: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Room Reveal Time</label>
                  <Input type="datetime-local" value={matchForm.reveal_time} onChange={(e) => setMatchForm({ ...matchForm, reveal_time: e.target.value })} className="bg-muted border-border mt-1" />
                </div>
              </div>
              <Button type="submit" className="btn-neon rounded-md text-primary-foreground font-heading uppercase tracking-wider">Create Match</Button>
            </form>

            <h3 className="font-heading text-lg font-semibold uppercase mb-3">Existing Matches</h3>
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.id} className="card-gaming p-4 flex justify-between items-center">
                  <span className="font-heading">Match #{m.match_number}</span>
                  <span className="text-xs text-muted-foreground">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "TBD"}</span>
                  <Badge>{m.status}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* SCORES */}
          <TabsContent value="scores">
            <h2 className="font-heading text-xl font-semibold uppercase mb-4">Add Score</h2>
            <form onSubmit={addScore} className="card-gaming p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Match</label>
                  <select value={scoreForm.match_id} onChange={(e) => setScoreForm({ ...scoreForm, match_id: e.target.value })} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm mt-1">
                    <option value="">Select Match</option>
                    {matches.map((m) => <option key={m.id} value={m.id}>Match #{m.match_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Player</label>
                  <select value={scoreForm.player_id} onChange={(e) => setScoreForm({ ...scoreForm, player_id: e.target.value })} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm mt-1">
                    <option value="">Select Player</option>
                    {players.filter(p => p.payment_status === "approved").map((p) => <option key={p.id} value={p.id}>{p.player_name} ({p.player_id_code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Kills</label>
                  <Input type="number" value={scoreForm.kills} onChange={(e) => setScoreForm({ ...scoreForm, kills: parseInt(e.target.value) })} className="bg-muted border-border mt-1" />
                </div>
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Rank Points</label>
                  <Input type="number" value={scoreForm.rank_points} onChange={(e) => setScoreForm({ ...scoreForm, rank_points: parseInt(e.target.value) })} className="bg-muted border-border mt-1" />
                </div>
              </div>
              <Button type="submit" className="btn-neon rounded-md text-primary-foreground font-heading uppercase tracking-wider">Add Score</Button>
            </form>
          </TabsContent>

          {/* BROADCAST */}
          <TabsContent value="announce">
            <h2 className="font-heading text-xl font-semibold uppercase mb-4">Send Announcement</h2>
            <form onSubmit={sendAnnouncement} className="card-gaming p-6 space-y-4">
              <div>
                <label className="text-xs font-heading uppercase text-muted-foreground">Title</label>
                <Input value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} required className="bg-muted border-border mt-1" />
              </div>
              <div>
                <label className="text-xs font-heading uppercase text-muted-foreground">Message</label>
                <Textarea value={annForm.message} onChange={(e) => setAnnForm({ ...annForm, message: e.target.value })} required rows={4} className="bg-muted border-border mt-1" />
              </div>
              <Button type="submit" className="btn-neon rounded-md text-primary-foreground font-heading uppercase tracking-wider">Send Announcement</Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
