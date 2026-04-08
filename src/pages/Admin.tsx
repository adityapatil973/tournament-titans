import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Gamepad2, BarChart3, Megaphone, Plus, Check, X, Download, Upload, Image, Pencil, Save, Trash2 } from "lucide-react";

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("players");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);

  const emptyTournamentForm = {
    name: "", description: "", entry_fee: 0, prize_pool: 0, max_players: 100,
    rules: "", youtube_live_url: "", whatsapp_link: "", telegram_link: "", upi_id: "",
    start_date: "", status: "upcoming" as string,
  };
  const [tournamentForm, setTournamentForm] = useState(emptyTournamentForm);
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);

  const [matchForm, setMatchForm] = useState({
    tournament_id: "", match_number: 1, room_id: "", room_password: "",
    scheduled_at: "", reveal_time: "",
  });

  const [scoreForm, setScoreForm] = useState({ match_id: "", player_id: "", kills: 0, rank_points: 0 });
  const [annForm, setAnnForm] = useState({ title: "", message: "", tournament_id: "" });
  const [csvUploading, setCsvUploading] = useState(false);

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

  const saveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    let qrCodeUrl: string | null = null;

    if (qrCodeFile) {
      const ext = qrCodeFile.name.split(".").pop();
      const path = `qr-codes/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-screenshots")
        .upload(path, qrCodeFile);
      if (uploadError) { toast.error("QR upload failed: " + uploadError.message); return; }
      const { data: urlData } = supabase.storage
        .from("payment-screenshots")
        .getPublicUrl(path);
      qrCodeUrl = urlData.publicUrl;
    }

    const payload: any = {
      name: tournamentForm.name,
      description: tournamentForm.description || null,
      entry_fee: tournamentForm.entry_fee,
      prize_pool: tournamentForm.prize_pool,
      max_players: tournamentForm.max_players,
      rules: tournamentForm.rules || null,
      youtube_live_url: tournamentForm.youtube_live_url || null,
      whatsapp_link: tournamentForm.whatsapp_link || null,
      telegram_link: tournamentForm.telegram_link || null,
      upi_id: tournamentForm.upi_id || null,
      start_date: tournamentForm.start_date || null,
      status: tournamentForm.status as any,
    };
    if (qrCodeUrl) payload.qr_code_url = qrCodeUrl;

    if (editingTournamentId) {
      const { error } = await supabase.from("tournaments").update(payload).eq("id", editingTournamentId);
      if (error) toast.error(error.message);
      else { toast.success("Tournament updated!"); setEditingTournamentId(null); setTournamentForm(emptyTournamentForm); setQrCodeFile(null); fetchAll(); }
    } else {
      if (qrCodeUrl) payload.qr_code_url = qrCodeUrl;
      else payload.qr_code_url = null;
      const { error } = await supabase.from("tournaments").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success("Tournament created!"); setTournamentForm(emptyTournamentForm); setQrCodeFile(null); fetchAll(); }
    }
  };

  const startEditTournament = (t: any) => {
    setEditingTournamentId(t.id);
    setTournamentForm({
      name: t.name || "",
      description: t.description || "",
      entry_fee: t.entry_fee || 0,
      prize_pool: t.prize_pool || 0,
      max_players: t.max_players || 100,
      rules: t.rules || "",
      youtube_live_url: t.youtube_live_url || "",
      whatsapp_link: t.whatsapp_link || "",
      telegram_link: t.telegram_link || "",
      upi_id: t.upi_id || "",
      start_date: t.start_date ? new Date(t.start_date).toISOString().slice(0, 16) : "",
      status: t.status || "upcoming",
    });
    setActiveTab("tournament");
  };

  const cancelEdit = () => {
    setEditingTournamentId(null);
    setTournamentForm(emptyTournamentForm);
    setQrCodeFile(null);
  };

  const updateMatchStatus = async (matchId: string, status: string) => {
    const { error } = await supabase.from("matches").update({ status: status as any }).eq("id", matchId);
    if (error) toast.error(error.message);
    else { toast.success(`Match marked as ${status}`); fetchAll(); }
  };

  const deleteTournament = async (id: string, name: string) => {
    if (!confirm(`Delete tournament "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Tournament deleted"); if (editingTournamentId === id) cancelEdit(); fetchAll(); }
  };

  const deleteMatch = async (id: string, num: number) => {
    if (!confirm(`Delete Match #${num}? This cannot be undone.`)) return;
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Match deleted"); fetchAll(); }
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

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);

    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const header = lines[0].toLowerCase();

      // Expected CSV: player_id_code, match_number (or match_id), kills, rank_points
      // Or: player_name, kills, rank_points (with match selected)
      const rows = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim());
        return cols;
      });

      if (rows.length === 0) { toast.error("CSV is empty"); return; }

      // Detect format: if header has "match" then match is in CSV, else we need a selected match
      const hasMatch = header.includes("match");
      const headers = header.split(",").map(h => h.trim());
      
      let successCount = 0;
      let errorCount = 0;

      for (const row of rows) {
        try {
          const rowData: Record<string, string> = {};
          headers.forEach((h, i) => { rowData[h] = row[i] || ""; });

          // Find player by player_id_code or player name
          const playerIdentifier = rowData["player_id_code"] || rowData["player_id"] || rowData["player_name"] || rowData["player"];
          const kills = parseInt(rowData["kills"] || "0");
          const rankPoints = parseInt(rowData["rank_points"] || rowData["rank"] || "0");

          // Find player
          let playerId = "";
          if (rowData["player_id_code"] || rowData["player_id"]) {
            const code = rowData["player_id_code"] || rowData["player_id"];
            const { data: found } = await supabase.from("players").select("id").eq("player_id_code", code).maybeSingle();
            if (found) playerId = found.id;
          } else if (playerIdentifier) {
            const { data: found } = await supabase.from("players").select("id").eq("player_name", playerIdentifier).maybeSingle();
            if (found) playerId = found.id;
          }

          // Find match
          let matchId = "";
          if (rowData["match_id"]) {
            matchId = rowData["match_id"];
          } else if (rowData["match_number"] || rowData["match"]) {
            const num = parseInt(rowData["match_number"] || rowData["match"]);
            const { data: found } = await supabase.from("matches").select("id").eq("match_number", num).maybeSingle();
            if (found) matchId = found.id;
          } else if (scoreForm.match_id) {
            matchId = scoreForm.match_id;
          }

          if (!playerId || !matchId) { errorCount++; continue; }

          const total = kills + rankPoints;
          const { error } = await supabase.from("scores").insert({
            match_id: matchId, player_id: playerId, kills, rank_points: rankPoints, total_points: total,
          });
          if (error) errorCount++;
          else successCount++;
        } catch { errorCount++; }
      }

      toast.success(`CSV imported: ${successCount} scores added, ${errorCount} errors`);
    } catch (err: any) {
      toast.error("CSV parse error: " + err.message);
    } finally {
      setCsvUploading(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const sendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("announcements").insert({
      title: annForm.title, message: annForm.message, tournament_id: annForm.tournament_id || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Announcement sent!"); setAnnForm({ ...annForm, title: "", message: "" }); }
  };

  const downloadResults = () => {
    const csv = ["Player Name,FF UID,Kills,Rank Points,Total Points"];
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "results.csv"; a.click();
  };

  const downloadScoreTemplate = () => {
    const csv = "player_id_code,match_number,kills,rank_points\nFF-ABC123,1,5,12\nFF-DEF456,1,3,8";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "score_template.csv"; a.click();
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-xl font-semibold uppercase">
                {editingTournamentId ? "Edit Tournament" : "Create Tournament"}
              </h2>
              {editingTournamentId && (
                <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel Edit</Button>
              )}
            </div>
            <form onSubmit={saveTournament} className="card-gaming p-6 space-y-4">
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

              {/* QR Code Upload */}
              <div>
                <label className="text-xs font-heading uppercase text-muted-foreground">UPI QR Code Image</label>
                <div className="mt-1">
                  <label className="flex items-center gap-3 cursor-pointer card-gaming p-4 hover:border-primary/50 transition-colors">
                    <Image className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">{qrCodeFile ? qrCodeFile.name : "Upload QR Code image..."}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setQrCodeFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>

              {/* Status (only when editing) */}
              {editingTournamentId && (
                <div>
                  <label className="text-xs font-heading uppercase text-muted-foreground">Status</label>
                  <select value={tournamentForm.status} onChange={(e) => setTournamentForm({ ...tournamentForm, status: e.target.value })} className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm mt-1">
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-heading uppercase text-muted-foreground">Description</label>
                <Textarea value={tournamentForm.description} onChange={(e) => setTournamentForm({ ...tournamentForm, description: e.target.value })} className="bg-muted border-border mt-1" />
              </div>
              <div>
                <label className="text-xs font-heading uppercase text-muted-foreground">Rules</label>
                <Textarea value={tournamentForm.rules} onChange={(e) => setTournamentForm({ ...tournamentForm, rules: e.target.value })} rows={5} className="bg-muted border-border mt-1" />
              </div>
              <Button type="submit" className="btn-neon rounded-md text-primary-foreground font-heading uppercase tracking-wider gap-2">
                {editingTournamentId ? <><Save className="w-4 h-4" /> Update Tournament</> : <><Plus className="w-4 h-4" /> Create Tournament</>}
              </Button>
            </form>

            {/* Existing Tournaments List */}
            <h3 className="font-heading text-lg font-semibold uppercase mb-3 mt-8">Existing Tournaments</h3>
            <div className="space-y-3">
              {tournaments.map((t) => (
                <div key={t.id} className="card-gaming p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-heading font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Fee: ₹{t.entry_fee} · Prize: ₹{t.prize_pool} · Max: {t.max_players}
                    </div>
                  </div>
                  <Badge>{t.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => startEditTournament(t)} className="gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteTournament(t.id, t.name)} className="gap-1 text-neon-red border-neon-red/30 hover:bg-neon-red/10">
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              ))}
              {tournaments.length === 0 && <p className="text-muted-foreground text-center py-4">No tournaments yet</p>}
            </div>
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
                <div key={m.id} className="card-gaming p-4 flex flex-wrap justify-between items-center gap-3">
                  <span className="font-heading">Match #{m.match_number}</span>
                  <span className="text-xs text-muted-foreground">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "TBD"}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={m.status}
                      onChange={(e) => updateMatchStatus(m.id, e.target.value)}
                      className="bg-muted border border-border rounded-md px-2 py-1 text-xs font-heading uppercase"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                    </select>
                    <Button size="sm" variant="outline" onClick={() => deleteMatch(m.id, m.match_number)} className="gap-1 text-neon-red border-neon-red/30 hover:bg-neon-red/10">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* SCORES */}
          <TabsContent value="scores">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
              <h2 className="font-heading text-xl font-semibold uppercase">Manage Scores</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadScoreTemplate} className="gap-2">
                  <Download className="w-4 h-4" /> Template CSV
                </Button>
                <label className="inline-flex">
                  <Button size="sm" variant="outline" className="gap-2" disabled={csvUploading} asChild>
                    <span className="cursor-pointer">
                      <Upload className="w-4 h-4" /> {csvUploading ? "Importing..." : "Upload CSV"}
                      <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            <div className="card-gaming p-4 mb-6 text-sm text-muted-foreground">
              <p className="font-heading uppercase text-xs text-primary mb-2">CSV Format</p>
              <code className="text-xs">player_id_code, match_number, kills, rank_points</code>
              <p className="mt-1 text-xs">You can also select a match below first, then use a CSV with just: player_id_code, kills, rank_points</p>
            </div>

            <h3 className="font-heading text-lg font-semibold uppercase mb-3">Add Single Score</h3>
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