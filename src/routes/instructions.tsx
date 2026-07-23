import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShieldCheck, Camera, Mic, MapPin, Maximize, Wifi, Monitor, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getSession, enqueueSyncRecord, type CandidateSession } from "@/lib/idb";

export const Route = createFileRoute("/instructions")({
  head: () => ({ meta: [{ title: "Instructions — Proctor" }] }),
  component: Instructions,
});

type PermStatus = "idle" | "granted" | "denied" | "loading";

function Instructions() {
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [agree, setAgree] = useState(false);
  const [camStatus, setCamStatus] = useState<PermStatus>("idle");
  const [micStatus, setMicStatus] = useState<PermStatus>("idle");
  const [locStatus, setLocStatus] = useState<PermStatus>("idle");
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  // Load session from IDB on mount — redirect if missing
  useEffect(() => {
    getSession().then((s) => {
      if (!s) { navigate({ to: "/" }); return; }
      setSession(s);
    });
  }, [navigate]);

  const requestPermissions = async () => {
    setCamStatus("loading"); setMicStatus("loading"); setLocStatus("loading");

    // Camera + Mic — keep retrying until granted
    let camGranted = false;
    while (!camGranted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setCamStatus("granted"); setMicStatus("granted");
        camGranted = true;
      } catch {
        setCamStatus("denied"); setMicStatus("denied");
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          window.alert(
            "Camera and microphone access is required to take the exam.\n\n" +
            "Please click 'Allow' in your browser's permission prompt, then click OK here to try again."
          );
          resolve();
        });
        setCamStatus("loading"); setMicStatus("loading");
      }
    }

    // Location — keep retrying until granted
    let locGranted = false;
    while (!locGranted) {
      // eslint-disable-next-line no-await-in-loop
      const result = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null));
      });

      if (result) {
        setLocStatus("granted");
        locGranted = true;
        // Log location — try Supabase first, queue to IDB if offline
        const auditPayload = {
          actor: session?.name ?? "Unknown",
          event: `Location captured: ${result.coords.latitude.toFixed(4)}, ${result.coords.longitude.toFixed(4)}`,
          severity: "info",
          client: navigator.userAgent.slice(0, 80),
        };
        const { error } = await supabase.from("audit_logs").insert(auditPayload);
        if (error) {
          await enqueueSyncRecord({ type: "audit", payload: auditPayload });
        }
      } else {
        setLocStatus("denied");
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          window.alert(
            "Location access is required to take the exam.\n\n" +
            "Please allow location access in your browser settings, then click OK to try again."
          );
          resolve();
        });
        setLocStatus("loading");
      }
    }
  };

  const allGranted = camStatus === "granted" && micStatus === "granted" && locStatus === "granted";

  const startExam = async () => {
    if (!allGranted) { toast.error("Grant all permissions first"); return; }
    if (!agree) { toast.error("Please agree to the exam rules"); return; }
    if (!session) { toast.error("Session expired. Please sign in again."); navigate({ to: "/" }); return; }
    setStarting(true);

    // Upsert exam session — queue to IDB if Supabase is unavailable
    const sessionPayload = {
      candidate_id: session.id,
      candidate_name: session.name,
      exam_id: session.examId,
      exam_name: session.examName,
      status: "live",
      question_index: 0,
      warnings: 0,
    };
    const { error: sessErr } = await supabase.from("exam_sessions").upsert(sessionPayload);
    if (sessErr) await enqueueSyncRecord({ type: "exam_session", payload: sessionPayload });

    const auditPayload = {
      actor: session.name,
      event: `Exam started — ${session.examName}`,
      severity: "info",
      client: navigator.userAgent.slice(0, 80),
    };
    const { error: auditErr } = await supabase.from("audit_logs").insert(auditPayload);
    if (auditErr) await enqueueSyncRecord({ type: "audit", payload: auditPayload });

    try { await document.documentElement.requestFullscreen(); } catch { /* ignore */ }
    setStarting(false);
    navigate({ to: "/exam" });
  };

  const PermIcon = ({ status }: { status: PermStatus }) => {
    if (status === "loading") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (status === "granted") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === "denied") return <XCircle className="h-4 w-4 text-destructive" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="font-semibold">Proctor</div>
        {session?.name && <span className="text-sm text-muted-foreground">· {session.name}</span>}
        <div className="ml-auto"><ThemeToggle /></div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exam instructions</h1>
          <p className="text-sm text-muted-foreground mt-1">Please read carefully before starting the examination.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Exam rules</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>· Do not exit fullscreen or switch tabs during the exam.</p>
              <p>· After 2 warnings your exam will be automatically terminated.</p>
              <p>· Camera, microphone and location must remain active.</p>
              <p>· You may skip and revisit questions before submission.</p>
              <p>· Only your current device, browser, and location will be used.</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">System requirements</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <div className="grid grid-cols-2 gap-3">
                {([
                  [Camera, "Working webcam", camStatus],
                  [Mic, "Microphone", micStatus],
                  [MapPin, "Location access", locStatus],
                  [Maximize, "Fullscreen mode", "idle"],
                  [Wifi, "Stable internet", "idle"],
                  [Monitor, "Latest Chrome / Edge", "idle"],
                ] as const).map(([Icon, label, status], i) => {
                  const IconComp = Icon as React.ComponentType<{ className?: string }>;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <IconComp className="h-4 w-4 text-primary" />
                      <span className="flex-1">{label}</span>
                      <PermIcon status={status as PermStatus} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {!allGranted && (
          <Card className={`rounded-xl ${camStatus === "denied" || locStatus === "denied" ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {camStatus === "idle" && locStatus === "idle"
                  ? "Camera, microphone and location access are required to start the exam."
                  : "Some permissions are missing. Please grant all permissions to continue."}
              </p>
              <Button
                className="rounded-lg shrink-0"
                onClick={requestPermissions}
                disabled={camStatus === "loading" || locStatus === "loading"}
              >
                {camStatus === "loading" || locStatus === "loading"
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Requesting…</>
                  : camStatus === "denied" || locStatus === "denied"
                  ? "Retry permissions"
                  : "Grant permissions"}
              </Button>
            </CardContent>
          </Card>
        )}

        {allGranted && (
          <Card className="rounded-xl border-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <p className="text-sm text-success">All permissions granted. You may start the exam.</p>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl">
          <CardContent className="p-4 flex items-start gap-3">
            <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
            <label htmlFor="agree" className="text-sm text-muted-foreground select-none">
              I have read and agree to the exam rules. I understand that camera, microphone, and location
              access are mandatory and that any violation may lead to termination of my exam.
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" className="rounded-lg" onClick={() => navigate({ to: "/" })}>Cancel</Button>
          <Button disabled={!agree || !allGranted || starting || !session} className="rounded-lg" onClick={startExam}>
            {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</> : "Start exam"}
          </Button>
        </div>
      </div>
    </div>
  );
}
