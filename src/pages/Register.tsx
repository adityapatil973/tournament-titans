import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Upload, QrCode } from "lucide-react";

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    playerName: "",
    freeFireUid: "",
    teamName: "",
    phone: "",
    email: "",
    transactionId: "",
    antiCheat: false,
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setTournament(data));
  }, [user, navigate]);

  const generatePlayerId = () => {
    return "FF-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tournament) return;
    if (!form.antiCheat) {
      toast.error("You must accept the anti-cheat declaration");
      return;
    }
    if (tournament.entry_fee > 0 && !screenshot) {
      toast.error("Payment screenshot is required");
      return;
    }
    if (tournament.entry_fee > 0 && !form.transactionId.trim()) {
      toast.error("Transaction ID is required");
      return;
    }
    setLoading(true);

    try {
      // Block duplicate UID for this tournament
      const { data: existing } = await supabase
        .from("players")
        .select("id")
        .eq("tournament_id", tournament.id)
        .eq("free_fire_uid", form.freeFireUid)
        .maybeSingle();
      if (existing) throw new Error("This Free Fire UID is already registered for this tournament");

      let screenshotPath = "";
      if (screenshot) {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowed.includes(screenshot.type)) {
          throw new Error("Only JPEG, PNG, WEBP or GIF images are allowed");
        }
        if (screenshot.size > 5 * 1024 * 1024) {
          throw new Error("Image must be smaller than 5 MB");
        }
        const ext = screenshot.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("payment-screenshots")
          .upload(path, screenshot, { contentType: screenshot.type, upsert: false });
        if (uploadError) throw uploadError;
        screenshotPath = path;
      }

      const { error } = await supabase.from("players").insert({
        user_id: user.id,
        tournament_id: tournament.id,
        player_name: form.playerName,
        free_fire_uid: form.freeFireUid,
        team_name: form.teamName || null,
        phone: form.phone,
        email: form.email || null,
        transaction_id: form.transactionId || null,
        payment_screenshot_url: screenshotPath || null,
        player_id_code: generatePlayerId(),
        anti_cheat_accepted: form.antiCheat,
      });

      if (error) throw error;
      toast.success("Registration successful! Your payment is under review.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!tournament) return <div className="min-h-screen pt-20 text-center text-muted-foreground">No active tournament</div>;

  return (
    <div className="min-h-screen pt-20 pb-10 px-4">
      <div className="container mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-center mb-2 text-glow-blue uppercase">Register</h1>
          <p className="text-center text-muted-foreground mb-8 font-heading">{tournament.name}</p>

          {/* Payment Info */}
          <div className="card-gaming p-6 mb-8 text-center">
            <h3 className="font-heading text-lg font-semibold mb-3 text-neon-yellow uppercase">Payment Required</h3>
            <p className="text-muted-foreground mb-2">Entry Fee: <span className="text-neon-green font-bold">₹{tournament.entry_fee}</span></p>
            {tournament.upi_id && (
              <p className="text-muted-foreground">UPI ID: <span className="text-primary font-mono">{tournament.upi_id}</span></p>
            )}
            {tournament.qr_code_url && (
              <div className="mt-4">
                <img src={tournament.qr_code_url} alt="UPI QR Code" className="mx-auto max-w-[200px] rounded-lg border border-border" />
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <QrCode className="w-4 h-4" />
              <span>Pay via UPI & upload screenshot below</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="card-gaming p-6 space-y-5">
            <div>
              <label className="text-sm font-heading uppercase tracking-wider text-muted-foreground">Player Name *</label>
              <Input value={form.playerName} onChange={(e) => setForm({ ...form, playerName: e.target.value })} required className="bg-muted border-border mt-1" />
            </div>
            <div>
              <label className="text-sm font-heading uppercase tracking-wider text-muted-foreground">Free Fire UID *</label>
              <Input value={form.freeFireUid} onChange={(e) => setForm({ ...form, freeFireUid: e.target.value })} required className="bg-muted border-border mt-1" />
            </div>
            <div>
              <label className="text-sm font-heading uppercase tracking-wider text-muted-foreground">Phone Number *</label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="bg-muted border-border mt-1" />
            </div>
            <div>
              <label className="text-sm font-heading uppercase tracking-wider text-muted-foreground">Email (Optional)</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-muted border-border mt-1" />
            </div>
            <div>
              <label className="text-sm font-heading uppercase tracking-wider text-muted-foreground">Payment Screenshot</label>
              <div className="mt-1">
                <label className="flex items-center gap-3 cursor-pointer card-gaming p-4 hover:border-primary/50 transition-colors">
                  <Upload className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">{screenshot ? screenshot.name : "Choose file..."}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                checked={form.antiCheat}
                onCheckedChange={(checked) => setForm({ ...form, antiCheat: !!checked })}
              />
              <label className="text-sm text-muted-foreground leading-relaxed">
                I declare that I will not use any hacks, cheats, or third-party tools during the tournament. Violation will result in immediate disqualification.
              </label>
            </div>
            <Button type="submit" disabled={loading} className="w-full btn-neon rounded-md text-primary-foreground font-heading uppercase tracking-wider py-6 text-lg">
              {loading ? "Submitting..." : "Submit Registration"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
