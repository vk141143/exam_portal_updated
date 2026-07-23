import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, GraduationCap, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { saveSession, flushPendingSync } from "@/lib/idb";

export const Route = createFileRoute("/")(({
  head: () => ({
    meta: [
      { title: "Sign in — Proctor Examination Portal" },
      { name: "description", content: "Sign in to your secure online examination portal." },
    ],
  }),
  component: LoginPage,
}));

function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);
  const [candidateId, setCandidateId] = useState("");
  const [password, setPassword] = useState("");
  const [examCode, setExamCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId.trim() || !password || !examCode.trim()) {
      toast.error("Enter your Candidate ID, password and Exam Code");
      return;
    }
    setLoading(true);

    try {
      // 1. Fetch candidate
      const { data: candidate, error: candError } = await supabase
        .from("candidates")
        .select("id, name, password_hash, status, assigned_exam_id")
        .eq("id", candidateId.trim())
        .single();

      if (candError || !candidate) {
        toast.error("Candidate not found");
        return;
      }
      if (candidate.status === "Disabled") {
        toast.error("Your account has been disabled. Contact admin.");
        return;
      }
      if (candidate.password_hash !== password) {
        toast.error("Invalid password");
        return;
      }

      // 2. Validate exam code
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .select("id, name, status")
        .eq("exam_code", examCode.trim())
        .single();

      if (examError || !exam) {
        toast.error("Invalid exam code");
        return;
      }
      if (exam.id !== candidate.assigned_exam_id) {
        toast.error("You are not assigned to this exam");
        return;
      }
      if (exam.status === "Draft") {
        toast.error("This exam has not started yet");
        return;
      }

      // 3. Audit log (best-effort — don't block login)
      void supabase.from("audit_logs").insert({
        actor: candidate.name,
        event: `Candidate login — ${exam.name}`,
        severity: "info",
        client: navigator.userAgent.slice(0, 80),
      });

      // 4. Save session to IndexedDB + localStorage
      await saveSession({
        id: candidate.id,
        name: candidate.name,
        examId: exam.id,
        examName: exam.name,
      });

      // 5. Flush any offline-queued records from a previous session
      flushPendingSync(supabase).catch(() => {});

      navigate({ to: "/instructions" });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-border bg-sidebar">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Proctor</span>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Secure, AI-proctored online examinations.
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Enterprise-grade assessments with live monitoring, face detection,
            fullscreen enforcement, and audit-ready reporting.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[["99.98%", "Uptime SLA"], ["SOC 2", "Compliant"], ["24/7", "Monitoring"], ["AES-256", "Encryption"]].map(([v, k]) => (
              <div key={k} className="rounded-lg border border-border p-4 bg-card">
                <div className="text-lg font-semibold">{v}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{k}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Proctor Systems · v1.0.0</div>
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
          <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Candidate sign in</h2>
              <p className="text-sm text-muted-foreground">Use the credentials provided by your administrator.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Candidate ID</Label>
                <Input placeholder="e.g. STU10234" value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative">
                  <Input type={showPwd ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
                  <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Exam Code</Label>
                <Input placeholder="e.g. EXAM-2024-DBMS" value={examCode} onChange={(e) => setExamCode(e.target.value.toUpperCase())} className="h-11 font-mono" />
              </div>
              <div className="flex items-center justify-end text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Credentials provided by admin</span>
              </div>
              <Button type="submit" className="w-full h-11 rounded-lg" disabled={loading}>
                {loading ? "Verifying…" : <><GraduationCap className="h-4 w-4 mr-2" /> Sign in to Exam</>}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-background px-2">or</span></div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">Are you an administrator?</p>
              <Link to="/admin-login">
                <Button variant="outline" className="w-full h-11 rounded-lg">
                  <ShieldCheck className="h-4 w-4 mr-2" /> Admin portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
