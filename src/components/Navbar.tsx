import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Menu, X, Shield, User, LogOut } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const links = [
    { to: "/", label: "Home" },
    { to: "/scoreboard", label: "Scoreboard" },
    ...(user ? [{ to: "/stats", label: "My Stats" }, { to: "/dashboard", label: "Dashboard" }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="font-display text-xl font-bold tracking-wider text-glow-blue">
          FF<span className="text-accent">ARENA</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="font-heading text-sm uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
              {l.label}
            </Link>
          ))}
          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin && <Shield className="w-4 h-4 text-neon-purple" />}
              <Button size="sm" variant="outline" onClick={handleSignOut} className="gap-2 border-border">
                <LogOut className="w-3 h-3" /> Logout
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="btn-neon px-6 py-2 rounded-md text-primary-foreground">Login</Button>
            </Link>
          )}
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background p-4 space-y-3">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block font-heading uppercase tracking-wider text-muted-foreground hover:text-primary">
              {l.label}
            </Link>
          ))}
          {user ? (
            <Button size="sm" variant="outline" onClick={handleSignOut} className="w-full gap-2">
              <LogOut className="w-3 h-3" /> Logout
            </Button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)}>
              <Button size="sm" className="btn-neon w-full rounded-md text-primary-foreground">Login</Button>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
