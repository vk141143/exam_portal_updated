import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Video,
  Mic,
  Wifi,
  Maximize2,
  AlertTriangle,
  Flag,
  SkipForward,
  RotateCcw,
  Loader2,
  Star,
  PartyPopper,
  ShieldAlert,
  Maximize,
  MicOff,
} from "lucide-react";
import { MeetingProvider, useMeeting, useParticipant } from "@videosdk.live/react-sdk";
import { supabase } from "@/lib/supabase";
import { getVideoSDKToken, createMeeting } from "@/lib/videosdk";
import type { Question } from "@/lib/supabase-types";
import {
  getSession,
  clearSession,
  clearAnswers,
  saveQuestions,
  getQuestions,
  saveAnswers,
  getAnswers,
  enqueueSyncRecord,
  flushPendingSync,
  type CandidateSession,
} from "@/lib/idb";

export const Route = createFileRoute("/exam")({
  head: () => ({ meta: [{ title: "Exam in progress — Proctor" }] }),
  component: ExamRoot,
});

function ExamRoot() {
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<CandidateSession | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getSession().then((s) => {
      if (!s) {
        navigate({ to: "/" });
        return;
      }
      setSession(s);
    });
  }, [navigate]);

  useEffect(() => {
    if (!session?.examId) return;
    (async () => {
      try {
        const tok = await getVideoSDKToken();
        setToken(tok);
        const { data: exam } = await supabase
          .from("exams")
          .select("meeting_id")
          .eq("id", session.examId)
          .single();
        if (exam?.meeting_id) {
          setMeetingId(exam.meeting_id);
        } else {
          const mid = await createMeeting(tok);
          await supabase.from("exams").update({ meeting_id: mid }).eq("id", session.examId);
          setMeetingId(mid);
        }
      } catch (e) {
        console.warn("VideoSDK setup failed, continuing without proctoring:", e);
        // Use a placeholder so ExamUI renders even without VideoSDK
        setToken("unavailable");
        setMeetingId("unavailable");
      }
    })();
  }, [session?.examId]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading session…
        </div>
      </div>
    );
  }

  if (!meetingId || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Setting up proctoring…
        </div>
      </div>
    );
  }

  if (token === "unavailable" || meetingId === "unavailable") {
    return <ExamUI meetingId="" proctorUnavailable />;
  }

  return (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: true,
        webcamEnabled: true,
        name: session.name ?? "Candidate",
        participantId: session.id,
        debugMode: false,
      }}
      token={token}
      joinWithoutUserInteraction
    >
      <ExamUI meetingId={meetingId} />
    </MeetingProvider>
  );
}

type Status = "notVisited" | "answered" | "skipped" | "review";

function ExamUI({ meetingId, proctorUnavailable = false }: { meetingId: string; proctorUnavailable?: boolean }) {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flags, setFlags] = useState<Record<number, Status>>({});
  const [remaining, setRemaining] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [examDuration, setExamDuration] = useState(60);
  const [micOn, setMicOn] = useState(true);

  // Violation state
  const [violationOpen, setViolationOpen] = useState(false);
  const [violationMsg, setViolationMsg] = useState("");
  const [questionsHidden, setQuestionsHidden] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const warningsRef = useRef(0);
  const submittingRef = useRef(false);

  // Post-submit flow
  const [showCongrats, setShowCongrats] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [submittedSession, setSubmittedSession] = useState<{
    id: string;
    name: string;
    examId: string;
    examName: string;
  } | null>(null);

  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("candidate_session") ?? "{}");
    } catch {
      return {};
    }
  }, []);

  // VideoSDK meeting controls
  const meetingCtx = proctorUnavailable
    ? { leave: () => {}, toggleMic: () => {}, localWebcamOn: false, localMicOn: false, localParticipant: null }
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useMeeting();
  const { leave, toggleMic, localWebcamOn, localMicOn, localParticipant } = meetingCtx;
  void leave;
  const webcamRef = useRef<HTMLVideoElement>(null);
  const { webcamStream } = proctorUnavailable
    ? { webcamStream: null }
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useParticipant(localParticipant?.id ?? "");
  useEffect(() => {
    if (webcamRef.current && webcamStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(webcamStream.track);
      webcamRef.current.srcObject = mediaStream;
      webcamRef.current.play().catch(() => {});
    }
  }, [webcamStream]);

  const toggleCandidateMic = () => {
    toggleMic();
    setMicOn((m) => !m);
  };
  void meetingId; // used by parent, suppress lint

  // Load questions
  useEffect(() => {
    if (!session.examId) {
      navigate({ to: "/" });
      return;
    }
    (async () => {
      const [{ data: qs }, { data: exam }] = await Promise.all([
        supabase.from("questions").select("*").eq("exam_id", session.examId),
        supabase.from("exams").select("duration_minutes").eq("id", session.examId).single(),
      ]);
      if (qs) setQuestions(qs as Question[]);
      if (exam) {
        setExamDuration(exam.duration_minutes);
        setRemaining(exam.duration_minutes * 60);
      }
      setLoadingQ(false);
    })();
  }, [session.examId, navigate]);

  const handleSubmit = useCallback(
    async (timeout = false, isTerminated = false) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      const totalMarks = questions.reduce((s, q) => s + (q.marks ?? 1), 0);
      const scored = questions.reduce(
        (s, q, i) => (answers[i] === q.correct_option ? s + (q.marks ?? 1) : s),
        0,
      );
      const pct = totalMarks > 0 ? Math.round((scored / totalMarks) * 100) : 0;
      const elapsed = examDuration * 60 - remaining;
      const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const ss = String(elapsed % 60).padStart(2, "0");
      const status = isTerminated ? "Terminated" : pct >= 40 ? "Pass" : "Fail";

      if (session.id) {
        await Promise.all([
          supabase.from("results").insert({
            candidate_id: session.id,
            candidate_name: session.name,
            exam_id: session.examId,
            exam_name: session.examName,
            score: pct,
            time_taken: `${mm}:${ss}`,
            warnings: warningsRef.current,
            status,
          }),
          supabase
            .from("exam_sessions")
            .update({ status: isTerminated ? "terminated" : "completed" })
            .eq("candidate_id", session.id),
          supabase.from("audit_logs").insert({
            actor: session.name,
            event: `Exam ${isTerminated ? "terminated" : timeout ? "timed out" : "submitted"} — ${session.examName}`,
            severity: isTerminated ? "danger" : "info",
            client: navigator.userAgent.slice(0, 80),
          }),
        ]);
      }

      // 1. Exit fullscreen
      try { await document.exitFullscreen(); } catch { /* ignore */ }

      // 2. Stop all media tracks (camera + mic)
      try {
        const stream = webcamRef.current?.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
        if (webcamRef.current) webcamRef.current.srcObject = null;
      } catch { /* ignore */ }

      // 3. Leave VideoSDK meeting
      try { leave(); } catch { /* ignore */ }

      setSubmittedSession({
        id: session.id,
        name: session.name,
        examId: session.examId,
        examName: session.examName,
      });
      localStorage.removeItem("candidate_session");

      if (isTerminated) {
        setTerminated(true);
      } else {
        setShowCongrats(true);
      }
    },
    [questions, answers, remaining, examDuration, session, leave],
  );

  // Timer
  useEffect(() => {
    if (loadingQ || remaining <= 0) return;
    const t = setInterval(
      () =>
        setRemaining((r) => {
          if (r <= 1) {
            clearInterval(t);
            handleSubmit(true);
            return 0;
          }
          return r - 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [loadingQ, remaining, handleSubmit]);

  // Violation handler
  const addWarning = useCallback(
    async (event: string) => {
      if (submittingRef.current) return;
      const newCount = warningsRef.current + 1;
      warningsRef.current = newCount;
      setWarnings(newCount);

      await supabase.from("audit_logs").insert({
        actor: session.name,
        event: `${event} — ${session.examName}`,
        severity: "warn",
        client: navigator.userAgent.slice(0, 80),
      });
      await supabase
        .from("exam_sessions")
        .update({ warnings: newCount })
        .eq("candidate_id", session.id);

      if (newCount >= 2) {
        // Terminate after 2nd warning
        setViolationMsg(event);
        setViolationOpen(true);
        setQuestionsHidden(true);
        await handleSubmit(false, true);
      } else {
        // Show warning popup, hide questions
        setViolationMsg(event);
        setViolationOpen(true);
        setQuestionsHidden(true);
      }
    },
    [session, handleSubmit],
  );

  // Violation detection — fullscreen exit, tab switch, window blur
  useEffect(() => {
    if (loadingQ) return;

    const onVisibility = () => {
      if (submittingRef.current) return;
      if (document.hidden) addWarning("Tab switch / window change detected");
    };
    const onFullscreen = () => {
      if (submittingRef.current) return;
      if (!document.fullscreenElement && !violationOpen) addWarning("Fullscreen exited");
    };
    const onBlur = () => {
      if (submittingRef.current) return;
      addWarning("Window focus lost (possible AI tool or app switch)");
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("blur", onBlur);
    };
  }, [loadingQ, addWarning, violationOpen]);

  // ── Hardware / screen-share detection (logs only, no warning count) ──
  useEffect(() => {
    if (loadingQ || !session.id) return;

    const logEvent = (event: string) =>
      supabase.from("audit_logs").insert({
        actor: session.name,
        event: `${event} — ${session.examName}`,
        severity: "danger",
        client: navigator.userAgent.slice(0, 80),
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scr = window.screen as any;

    // 1. External display / dual monitor via Screen Details API
    const checkExtendedDisplay = () => {
      if (scr.isExtended) logEvent("External display / dual monitor detected");
    };
    checkExtendedDisplay();
    scr.addEventListener?.("change", checkExtendedDisplay);

    // 2. Intercept getDisplayMedia — screen share / screen cast
    const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia?.bind(
      navigator.mediaDevices,
    );
    if (origGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async (opts?: DisplayMediaStreamOptions) => {
        logEvent("Screen sharing / screen cast attempted");
        addWarning("Screen sharing / screen cast detected");
        return origGetDisplayMedia(opts);
      };
    }

    // 3. USB device connected (external keyboard, HDMI adapter, etc.)
    const onUsbConnect = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dev = (e as any).device;
      const name = dev?.productName || dev?.manufacturerName || "Unknown USB device";
      logEvent(`USB device connected: ${name}`);
      addWarning(`USB device connected: ${name}`);
    };
    nav.usb?.addEventListener("connect", onUsbConnect);

    // 4. HID device connected (external keyboard / input device)
    const onHidConnect = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = (e as any).device?.productName || "Unknown HID device";
      logEvent(`HID device connected: ${name}`);
      addWarning(`External input device connected: ${name}`);
    };
    nav.hid?.addEventListener("connect", onHidConnect);

    // 5. Media device change — new camera/mic/display plugged in
    const onDeviceChange = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasNewDisplay = devices.some(
        (d) => d.kind === "videoinput" && d.label.toLowerCase().includes("display"),
      );
      if (hasNewDisplay) logEvent("New display/capture device detected via mediaDevices");
      else logEvent("Media device change detected (possible external device)");
    };
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);

    return () => {
      scr.removeEventListener?.("change", checkExtendedDisplay);
      if (origGetDisplayMedia) navigator.mediaDevices.getDisplayMedia = origGetDisplayMedia;
      nav.usb?.removeEventListener("connect", onUsbConnect);
      nav.hid?.removeEventListener("connect", onHidConnect);
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
    };
  }, [loadingQ, session, addWarning]);

  // Return to fullscreen from warning popup
  const returnToFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* ignore */
    }
    setViolationOpen(false);
    setQuestionsHidden(false);
  };

  useEffect(() => {
    setFlags((f) => (f[current] ? f : { ...f, [current]: "notVisited" }));
  }, [current]);

  // Feedback submit
  const submitFeedback = async () => {
    if (rating === 0) return;
    setFeedbackLoading(true);
    const { error } = await supabase.from("feedback").insert({
      candidate_id: submittedSession?.id ?? null,
      candidate_name: submittedSession?.name ?? null,
      exam_id: submittedSession?.examId ?? null,
      exam_name: submittedSession?.examName ?? null,
      rating,
      comment: feedbackText.trim() || null,
    });
    if (error) console.error("Feedback insert error:", error);
    setFeedbackLoading(false);
    setShowFeedback(false);
    navigate({ to: "/" });
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const isLow = remaining < 300;

  const stats = useMemo(() => {
    let ans = 0,
      skip = 0,
      rev = 0,
      nv = 0;
    questions.forEach((_, i) => {
      const s: Status = answers[i] !== undefined ? "answered" : (flags[i] ?? "notVisited");
      if (s === "answered") ans++;
      else if (s === "skipped") skip++;
      else if (s === "review") rev++;
      else nv++;
    });
    return { ans, skip, rev, nv };
  }, [answers, flags, questions]);

  const select = (opt: number) => {
    setAnswers((a) => ({ ...a, [current]: opt }));
    setFlags((f) => ({ ...f, [current]: "answered" }));
  };
  const next = () => setCurrent((c) => Math.min(questions.length - 1, c + 1));
  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const skip = () => {
    setFlags((f) => ({ ...f, [current]: "skipped" }));
    next();
  };
  const review = () => {
    setFlags((f) => ({ ...f, [current]: "review" }));
  };
  const clear = () => {
    setAnswers((a) => {
      const n = { ...a };
      delete n[current];
      return n;
    });
    setFlags((f) => ({ ...f, [current]: "notVisited" }));
  };
  const statusOf = (i: number): Status =>
    answers[i] !== undefined ? "answered" : (flags[i] ?? "notVisited");

  if (showCongrats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 py-4 max-w-sm w-full px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-success/10 grid place-items-center">
            <PartyPopper className="h-8 w-8 text-success" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Congratulations!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You have successfully completed the exam.
              <br />
              We will get back to you soon with your results.
            </p>
          </div>
          <Button
            className="w-full rounded-lg mt-2"
            onClick={() => {
              setShowCongrats(false);
              setShowFeedback(true);
            }}
          >
            OK
          </Button>
        </div>
      </div>
    );
  }

  if (showFeedback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm px-6 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold">Rate your experience</h2>
            <p className="text-sm text-muted-foreground">Help us improve the exam experience</p>
          </div>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className="h-8 w-8 transition-colors"
                  fill={(hoverRating || rating) >= star ? "var(--warning)" : "transparent"}
                  stroke={
                    (hoverRating || rating) >= star ? "var(--warning)" : "var(--muted-foreground)"
                  }
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
            </p>
          )}
          <div className="space-y-2">
            <Label>Feedback / suggestions to improve</Label>
            <Textarea
              placeholder="Share your thoughts on the exam experience…"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={() => navigate({ to: "/" })}
            >
              Skip
            </Button>
            <Button
              className="flex-1 rounded-lg"
              onClick={submitFeedback}
              disabled={feedbackLoading || rating === 0}
            >
              {feedbackLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit feedback"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingQ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading exam questions…
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">No questions found for this exam.</p>
          <Button onClick={() => navigate({ to: "/" })}>Go back</Button>
        </div>
      </div>
    );
  }

  // Terminated screen
  if (terminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 grid place-items-center mx-auto">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Exam Terminated</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your exam has been terminated due to repeated violations. Your result has been recorded
            as <strong>Terminated</strong>.
          </p>
          <Button className="w-full rounded-lg" onClick={() => navigate({ to: "/" })}>
            Go to home
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const opts: string[] = Array.isArray(q.options) ? q.options : [];
  const chosen = answers[current];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b flex items-center gap-3 px-4 sticky top-0 bg-background/90 backdrop-blur z-20">
        <div className="font-medium text-sm">{session.examName ?? "Exam"}</div>
        <Badge variant="secondary" className="rounded-md">
          {session.name} · {session.id}
        </Badge>
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-success" /> Online
          </span>
          <span className="flex items-center gap-1.5">
            <Maximize2 className="h-3.5 w-3.5 text-success" /> Fullscreen
          </span>
          <Badge
            variant="secondary"
            className={
              warnings > 0
                ? "bg-destructive/10 text-destructive border-0"
                : "bg-muted text-muted-foreground border-0"
            }
          >
            ⚠ {warnings}/2 warnings
          </Badge>
          <div
            className={`font-mono text-base tabular-nums ${isLow ? "text-destructive" : "text-foreground"}`}
          >
            {mm}:{ss}
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4 p-4">
        {/* Palette */}
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2 space-y-4">
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Question palette</div>
              <div className="grid grid-cols-8 lg:grid-cols-5 gap-1.5">
                {questions.map((_, i) => {
                  const s = statusOf(i);
                  const base = "h-8 w-8 text-xs rounded-md border transition font-medium";
                  const cls =
                    i === current
                      ? "bg-primary text-primary-foreground border-primary"
                      : s === "answered"
                        ? "bg-success/15 text-success border-success/30"
                        : s === "skipped"
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : s === "review"
                            ? "bg-warning/20 text-warning-foreground border-warning/40"
                            : "bg-card text-muted-foreground border-border hover:bg-accent";
                  return (
                    <button key={i} onClick={() => setCurrent(i)} className={`${base} ${cls}`}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 space-y-1.5 text-[11px] text-muted-foreground">
                <Legend swatch="bg-success/40" label={`Answered · ${stats.ans}`} />
                <Legend swatch="bg-destructive/40" label={`Skipped · ${stats.skip}`} />
                <Legend swatch="bg-warning/40" label={`Review · ${stats.rev}`} />
                <Legend swatch="bg-border" label={`Not visited · ${stats.nv}`} />
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Question area */}
        <section className="col-span-12 lg:col-span-6 xl:col-span-7 space-y-4">
          {questionsHidden ? (
            /* Blurred / hidden state — shown while warning popup is open */
            <Card className="rounded-xl">
              <CardContent className="p-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-14 w-14 rounded-full bg-warning/10 grid place-items-center">
                  <AlertTriangle className="h-7 w-7 text-warning-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Questions hidden</p>
                  <p className="text-sm text-muted-foreground">
                    Acknowledge the warning and return to fullscreen to continue.
                  </p>
                </div>
                <Button className="rounded-lg mt-2" onClick={returnToFullscreen}>
                  <Maximize className="h-4 w-4 mr-2" /> Return to fullscreen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="rounded-xl">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Question {current + 1} of {questions.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {q.marks ?? 1} mark{(q.marks ?? 1) > 1 ? "s" : ""}
                    </div>
                  </div>
                  <Progress value={((current + 1) / questions.length) * 100} className="h-1" />
                  <h2 className="text-base font-medium leading-relaxed">{q.question_text}</h2>
                  <div className="space-y-2 pt-1">
                    {opts.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => select(i)}
                        className={`w-full text-left p-3.5 rounded-lg border transition flex items-start gap-3 ${chosen === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/40"}`}
                      >
                        <div
                          className={`h-5 w-5 rounded-full border shrink-0 grid place-items-center mt-0.5 ${chosen === i ? "border-primary" : "border-border"}`}
                        >
                          {chosen === i && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground mr-2">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          {opt}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-lg"
                  onClick={prev}
                  disabled={current === 0}
                >
                  Previous
                </Button>
                <Button variant="outline" className="rounded-lg" onClick={review}>
                  <Flag className="h-4 w-4 mr-1.5" /> Mark for review
                </Button>
                <Button variant="outline" className="rounded-lg" onClick={clear}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Clear
                </Button>
                <Button variant="outline" className="rounded-lg" onClick={skip}>
                  <SkipForward className="h-4 w-4 mr-1.5" /> Skip
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    className="rounded-lg"
                    onClick={next}
                    disabled={current === questions.length - 1}
                  >
                    Save & Next
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-lg"
                    onClick={() => handleSubmit()}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Proctoring panel */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <Card className="rounded-xl overflow-hidden">
            <div className="aspect-video bg-black relative border-b border-success/40">
              {localWebcamOn ? (
                <video
                  ref={webcamRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-medium bg-background/80 backdrop-blur px-1.5 py-0.5 rounded">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> LIVE
              </div>
              <button
                onClick={toggleCandidateMic}
                className="absolute bottom-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
              >
                {micOn && localMicOn ? (
                  <Mic className="h-3.5 w-3.5 text-success" />
                ) : (
                  <MicOff className="h-3.5 w-3.5 text-destructive" />
                )}
              </button>
            </div>
            <CardContent className="p-3 space-y-3">
              <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Warnings</span>
                  <span
                    className={warnings > 0 ? "text-destructive font-medium" : "text-foreground"}
                  >
                    {warnings} / 2
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Mic</span>
                  <span className={localMicOn ? "text-success" : "text-destructive"}>
                    {localMicOn ? "On" : "Muted"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Camera</span>
                  <span className={localWebcamOn ? "text-success" : "text-destructive"}>
                    {localWebcamOn ? "On" : "Off"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Location</span>
                  <span className="text-success">Verified</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-warning/30 bg-warning/5">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Do not exit fullscreen or switch tabs. After 2 warnings your exam will be
                terminated.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* ── Warning popup ── */}
      <Dialog open={violationOpen} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-sm text-center"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <div
              className={`h-14 w-14 rounded-full grid place-items-center ${warningsRef.current >= 2 ? "bg-destructive/10" : "bg-warning/10"}`}
            >
              <ShieldAlert
                className={`h-7 w-7 ${warningsRef.current >= 2 ? "text-destructive" : "text-warning-foreground"}`}
              />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold">
                {warningsRef.current >= 2
                  ? "Exam Terminated"
                  : `Warning ${warningsRef.current} of 2`}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong>{violationMsg}</strong>
              </p>
              {warningsRef.current < 2 ? (
                <p className="text-sm text-muted-foreground">
                  You have{" "}
                  <strong className="text-destructive">
                    {2 - warningsRef.current} warning{2 - warningsRef.current === 1 ? "" : "s"}{" "}
                    remaining
                  </strong>
                  . Another violation will terminate your exam.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You have exceeded the allowed violations. Your exam has been{" "}
                  <strong className="text-destructive">terminated</strong> and recorded.
                </p>
              )}
            </div>
            {warningsRef.current < 2 ? (
              <Button className="w-full rounded-lg" onClick={returnToFullscreen}>
                <Maximize className="h-4 w-4 mr-2" /> Return to fullscreen & continue
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="w-full rounded-lg"
                onClick={() => {
                  setViolationOpen(false);
                }}
              >
                OK
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      <span>{label}</span>
    </div>
  );
}
