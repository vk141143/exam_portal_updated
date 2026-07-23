import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin-register")({
  head: () => ({ meta: [{ title: "Admin Register — Proctor" }] }),
  component: AdminRegister,
});

function AdminRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { toast.error("Fill all fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) {
      toast.error(error?.message ?? "Sign up failed");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("admin_profiles").insert({
      id: data.user.id,
      name,
      email,
      role: "admin",
    });

    setLoading(false);
    if (profileError) { toast.error(profileError.message); return; }
    toast.success("Account created! You can now sign in.");
    navigate({ to: "/admin-login" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-border bg-sidebar">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Proctor Admin</span>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">Create your admin account.</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Set up your administrator account to start managing exams and candidates.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Proctor Systems</div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Proctor</span>
          </div>
          <div className="ml-auto"><ThemeToggle /></div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <form onSubmit={submit} className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Create admin account</h2>
              <p className="text-sm text-muted-foreground">Register as a new administrator.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input placeholder="e.g. Dr. Ramesh Kumar" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="admin@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input type={showPwd ? "text" : "password"} placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
                  <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full h-11 rounded-lg" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link to="/admin-login" className="text-primary hover:underline">Sign in</Link>
            </p>
            <p className="text-sm text-center text-muted-foreground">
              <Link to="/" className="hover:underline">← Candidate portal</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
