import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Gamepad2, BarChart3, Megaphone, Plus, Check, X, Download, Upload, Image as ImageIcon, Pencil, Save, Trash2, Search, IndianRupee, UserCheck, Clock } from "lucide-react";

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [editingScore, setEditingScore] = useState<{ id: string; kills: number; rank_points: number } | null>(null);
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
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rejectingPlayer, setRejectingPlayer] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!user || !isAdmin) { navigate("/"); return; }
    fetchAll();
    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin]);

  const fetchAll = async () => {
    const [{ data: p }, { data: m }, { data: t }, { data: s }] = await Promise.all([
      supabase.from("players").select("*").order("created_at", { ascending: false }),
      supabase.from("matches").select("*").order("match_number"),
      supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
      supabase.from("scores").select("*, players(player_name, player_id_code), matches(match_number)").order("created_at", { ascending: false }),
    ]);
    setPlayers(p || []);
    setMatches(m || []);
    setTournaments(t || []);
    setScores(s || []);
    if (t?.[0]) {
      setMatchForm((f) => ({ ...f, tournament_id: t[0].id }));
      setAnnForm((f) => ({ ...f, tournament_id: t[0].id }));
    }
  };

  const updatePaymentStatus = async (playerId: string, status: string, reason?: string) => {
    const payload: any = { payment_status: status as any };
    if (status === "rejected") payload.rejection_reason = reason || null;
    if (status === "approved") payload.rejection_reason = null;
    const { error } = await supabase.from("players").update(payload).eq("id", playerId);
    if (error) toast.error(error.message);
    else { toast.success(`Payment ${status}`); fetchAll(); }
  };

  const deletePlayer = async (id: string, name: string) => {
    if (!confirm(`Delete player "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Player deleted"); fetchAll(); }
  };

  const openScreenshot = async (path: string) => {
    setPreviewLoading(true);
    setPreviewUrl(null);
    const { data, error } = await supabase.storage
      .from("payment-screenshots")
      .createSignedUrl(path, 3600);
    setPreviewLoading(false);
    if (error || !data) { toast.error("Could not load screenshot"); return; }
    setPreviewUrl(data.signedUrl);
  };

  const saveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    let qrCodeUrl: string | null = null;

    if (qrCodeFile) {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowed.includes(qrCodeFile.type)) { toast.error("QR must be a JPEG/PNG/WEBP/GIF image"); return; }
      if (qrCodeFile.size > 5 * 1024 * 1024) { toast.error("QR image must be smaller than 5 MB"); return; }
      const ext = qrCodeFile.name.split(".").pop();
      const path = `qr-codes/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("tournament-assets")
        .upload(path, qrCodeFile, { contentType: qrCodeFile.type, upsert: false });
      if (uploadError) { toast.error("QR upload failed: " + uploadError.message); return; }
      const { data: urlData } = supabase.storage
        .from("tournament-assets")
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
    if (!scoreForm.match_id || !scoreForm.player_id) { toast.error("Select match and player"); return; }
    const total = scoreForm.kills + scoreForm.rank_points;
    const { error } = await supabase.from("scores").insert({
      ...scoreForm,
      total_points: total,
    });
    if (error) toast.error(error.message);
    else { toast.success("Score added!"); setScoreForm({ match_id: "", player_id: "", kills: 0, rank_points: 0 }); fetchAll(); }
  };

  const saveScoreEdit = async () => {
    if (!editingScore) return;
    const total = editingScore.kills + editingScore.rank_points;
    const { error } = await supabase.from("scores").update({
      kills: editingScore.kills, rank_points: editingScore.rank_points, total_points: total,
    }).eq("id", editingScore.id);
    if (error) toast.error(error.message);
    else { toast.success("Score updated"); setEditingScore(null); fetchAll(); }
  };

  const deleteScore = async (id: string) => {
    if (!confirm("Delete this score entry?")) return;
    const { error } = await supabase.from("scores").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Score deleted"); fetchAll(); }
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
            {(() => {
              const total = players.length;
              const approved = players.filter(p => p.payment_status === "approved").length;
              const pending = players.filter(p => p.payment_status === "pending").length;
              const revenue = players
                .filter(p => p.payment_status === "approved")
                .reduce((sum, p) => {
                  const t = tournaments.find(t => t.id === p.tournament_id);
                  return sum + (t?.entry_fee || 0);
                }, 0);
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="card-gaming p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground uppercase font-heading"><Users className="w-4 h-4" />Total</div><div className="text-2xl font-bold mt-1">{total}</div></div>
                  <div className="card-gaming p-4"><div className="flex items-center gap-2 text-xs text-neon-green uppercase font-heading"><UserCheck className="w-4 h-4" />Approved</div><div className="text-2xl font-bold mt-1 text-neon-green">{approved}</div></div>
                  <div className="card-gaming p-4"><div className="flex items-center gap-2 text-xs text-neon-yellow uppercase font-heading"><Clock className="w-4 h-4" />Pending</div><div className="text-2xl font-bold mt-1 text-neon-yellow">{pending}</div></div>
                  <div className="card-gaming p-4"><div className="flex items-center gap-2 text-xs text-primary uppercase font-heading"><IndianRupee className="w-4 h-4" />Revenue</div><div className="text-2xl font-bold mt-1 text-primary">₹{revenue}</div></div>
                </div>
              );
            })()}

            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h2 className="font-heading text-xl font-semibold uppercase">Registered Players</h2>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} placeholder="Search name, UID, phone..." className="pl-9 bg-muted border-border w-64" />
                </div>
                <Select value={playerFilter} onValueChange={setPlayerFilter}>
                  <SelectTrigger className="w-36 bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={downloadResults} className="gap-2">
                  <Download className="w-4 h-4" /> Export CSV
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {players
                .filter(p => playerFilter === "all" || p.payment_status === playerFilter)
                .filter(p => {
                  const q = playerSearch.toLowerCase().trim();
                  if (!q) return true;
                  return [p.player_name, p.free_fire_uid, p.phone, p.player_id_code, p.team_name, p.transaction_id, p.email]
                    .some(v => v && String(v).toLowerCase().includes(q));
                })
                .map((p) => (
                <div key={p.id} className="card-gaming p-4 flex flex-wrap items-center justify-between gap-4">
                  {p.payment_screenshot_url ? (
                    <button
                      type="button"
                      onClick={() => openScreenshot(p.payment_screenshot_url)}
                      className="w-16 h-16 rounded border border-primary/30 bg-muted flex items-center justify-center hover:border-primary transition-colors shrink-0"
                      title="View payment screenshot"
                    >
                      <ImageIcon className="w-6 h-6 text-primary" />
                    </button>
                  ) : (
                    <div className="w-16 h-16 rounded border border-dashed border-border bg-muted/40 flex items-center justify-center shrink-0" title="No screenshot uploaded">
                      <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-heading font-semibold">
                      {p.player_name}
                      {p.team_name && <span className="ml-2 text-xs text-muted-foreground">[{p.team_name}]</span>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                      <span>UID: {p.free_fire_uid}</span>
                      <span>Phone: {p.phone}</span>
                      <span>ID: {p.player_id_code}</span>
                      {p.transaction_id && <span>Txn: {p.transaction_id}</span>}
                    </div>
                    {p.payment_status === "rejected" && p.rejection_reason && (
                      <div className="text-xs text-neon-red mt-1">Reason: {p.rejection_reason}</div>
                    )}
                  </div>
                  <Badge className={`${statusColor[p.payment_status]} border`}>{p.payment_status}</Badge>
                  <div className="flex gap-2 flex-wrap">
                    {p.payment_status !== "approved" && (
                      <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(p.id, "approved")} className="gap-1 text-neon-green border-neon-green/30 hover:bg-neon-green/10">
                        <Check className="w-3 h-3" /> Approve
                      </Button>
                    )}
                    {p.payment_status !== "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => { setRejectingPlayer(p); setRejectReason(""); }} className="gap-1 text-neon-red border-neon-red/30 hover:bg-neon-red/10">
                        <X className="w-3 h-3" /> Reject
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deletePlayer(p.id, p.player_name)} className="gap-1 text-muted-foreground hover:text-neon-red">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {players.length === 0 && <p className="text-muted-foreground text-center py-8">No players registered yet</p>}
            </div>

            {/* Screenshot preview dialog */}
            <Dialog open={!!previewUrl || previewLoading} onOpenChange={(o) => { if (!o) { setPreviewUrl(null); } }}>
              <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>Payment Screenshot</DialogTitle></DialogHeader>
                {previewLoading && <p className="text-center text-muted-foreground py-12">Loading...</p>}
                {previewUrl && (
                  <div className="space-y-3">
                    <img src={previewUrl} alt="Payment screenshot" className="w-full max-h-[70vh] object-contain rounded border border-border" />
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Open full size in new tab ↗</a>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Rejection reason dialog */}
            <Dialog open={!!rejectingPlayer} onOpenChange={(o) => { if (!o) setRejectingPlayer(null); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>Reject {rejectingPlayer?.player_name}</DialogTitle></DialogHeader>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection (e.g. invalid payment screenshot, wrong amount)..." className="bg-muted border-border min-h-24" />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRejectingPlayer(null)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!rejectReason.trim()) { toast.error("Please provide a reason"); return; }
                      await updatePaymentStatus(rejectingPlayer.id, "rejected", rejectReason.trim());
                      setRejectingPlayer(null);
                    }}
                  >Confirm Reject</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                    <ImageIcon className="w-5 h-5 text-primary" />
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

            <h3 className="font-heading text-lg font-semibold uppercase mb-3 mt-8">All Scores ({scores.length})</h3>
            <div className="card-gaming overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-heading uppercase text-muted-foreground border-b border-border bg-muted/20">
                <div className="col-span-4">Player</div>
                <div className="col-span-2">Match</div>
                <div className="col-span-2 text-center">Kills</div>
                <div className="col-span-2 text-center">Rank Pts</div>
                <div className="col-span-1 text-center">Total</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
              {scores.length === 0 && <p className="text-muted-foreground text-center py-6 text-sm">No scores yet</p>}
              {scores.map((s) => {
                const isEditing = editingScore?.id === s.id;
                return (
                  <div key={s.id} className="grid grid-cols-2 md:grid-cols-12 gap-2 items-center px-4 py-3 border-b border-border/50 last:border-0 text-sm">
                    <div className="col-span-2 md:col-span-4 font-heading">
                      {s.players?.player_name || "Unknown"}
                      <div className="text-xs text-muted-foreground">{s.players?.player_id_code}</div>
                    </div>
                    <div className="col-span-2 md:col-span-2 text-muted-foreground">Match #{s.matches?.match_number ?? "?"}</div>
                    <div className="col-span-1 md:col-span-2 md:text-center">
                      {isEditing ? (
                        <Input type="number" value={editingScore.kills} onChange={(e) => setEditingScore({ ...editingScore, kills: parseInt(e.target.value) || 0 })} className="bg-muted border-border h-8" />
                      ) : (<span className="font-display">{s.kills}</span>)}
                    </div>
                    <div className="col-span-1 md:col-span-2 md:text-center">
                      {isEditing ? (
                        <Input type="number" value={editingScore.rank_points} onChange={(e) => setEditingScore({ ...editingScore, rank_points: parseInt(e.target.value) || 0 })} className="bg-muted border-border h-8" />
                      ) : (<span className="font-display text-neon-purple">{s.rank_points}</span>)}
                    </div>
                    <div className="col-span-1 md:col-span-1 md:text-center font-display font-bold text-primary">
                      {isEditing ? editingScore.kills + editingScore.rank_points : s.total_points}
                    </div>
                    <div className="col-span-1 md:col-span-1 flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={saveScoreEdit}><Save className="w-3 h-3" /></Button>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setEditingScore(null)}><X className="w-3 h-3" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setEditingScore({ id: s.id, kills: s.kills, rank_points: s.rank_points })}><Pencil className="w-3 h-3" /></Button>
                          <Button size="icon" variant="outline" className="h-7 w-7 text-neon-red border-neon-red/30 hover:bg-neon-red/10" onClick={() => deleteScore(s.id)}><Trash2 className="w-3 h-3" /></Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

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