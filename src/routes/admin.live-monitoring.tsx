import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, MicOff, Video, VideoOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { MeetingProvider, useMeeting, useParticipant } from "@videosdk.live/react-sdk";
import { supabase } from "@/lib/supabase";
import { getVideoSDKToken } from "@/lib/videosdk";

export const Route = createFileRoute("/admin/live-monitoring")({
  head: () => ({ meta: [{ title: "Live Monitoring — Proctor Admin" }] }),
  component: LiveMonitoring,
});

type Exam = { id: string; name: string; meeting_id: string | null };
type LiveSession = { candidate_id: string; candidate_name: string; warnings: number };

// ── Single candidate tile — must be inside MeetingProvider ───────────────────
function CandidateTile({
  participantId,
  name,
  warnings,
  isSpeaking,
  onSpeak,
  onStopSpeak,
}: {
  participantId: string;
  name: string;
  warnings: number;
  isSpeaking: boolean;
  onSpeak: () => void;
  onStopSpeak: () => void;
}) {
  const { webcamStream, webcamOn, micOn } = useParticipant(participantId);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && webcamStream) {
      const ms = new MediaStream();
      ms.addTrack(webcamStream.track);
      videoRef.current.srcObject = ms;
      videoRef.current.play().catch(() => {});
    }
  }, [webcamStream]);

  return (
    <Card className={`rounded-xl overflow-hidden ${warnings > 0 ? "ring-1 ring-destructive/50" : ""}`}>
      <div className="aspect-video bg-black relative">
        {webcamOn
          ? <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><VideoOff className="h-8 w-8 text-muted-foreground/30" /></div>
        }
        <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] font-medium bg-background/80 backdrop-blur px-1.5 py-0.5 rounded">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> LIVE
        </div>
        {isSpeaking && (
          <div className="absolute top-2 right-2 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
            <Mic className="h-3 w-3" /> Speaking
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          {micOn
            ? <Mic className="h-3.5 w-3.5 text-success" />
            : <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">{name}</span>
          {warnings > 0
            ? <Badge className="bg-destructive/10 text-destructive border-0 shrink-0">⚠ {warnings}</Badge>
            : <Badge className="bg-success/10 text-success border-0 shrink-0">OK</Badge>}
        </div>
        {isSpeaking
          ? <Button size="sm" variant="destructive" className="w-full h-7 text-xs rounded-lg gap-1" onClick={onStopSpeak}>
              <MicOff className="h-3.5 w-3.5" /> Stop talking
            </Button>
          : <Button size="sm" variant="outline" className="w-full h-7 text-xs rounded-lg gap-1" onClick={onSpeak}>
              <Mic className="h-3.5 w-3.5" /> Talk to candidate
            </Button>
        }
      </CardContent>
    </Card>
  );
}

// ── Room view — admin joins the exam's shared meeting room ───────────────────
function ExamRoom({
  meetingId,
  token,
  sessions,
}: {
  meetingId: string;
  token: string;
  sessions: LiveSession[];
}) {
  const [speakingTo, setSpeakingTo] = useState<string | null>(null);
  const { participants, toggleMic, localMicOn } = useMeeting({ onMeetingJoined: () => {} });

  // Keep mic in sync with speakingTo
  const prevSpeaking = useRef<string | null>(null);
  useEffect(() => {
    const wasOn = prevSpeaking.current !== null;
    const isOn = speakingTo !== null;
    if (wasOn !== isOn) toggleMic();
    prevSpeaking.current = speakingTo;
  }, [speakingTo, toggleMic]);

  void localMicOn;

  // Map participantId → session info
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.candidate_id, s]));

  // Only show candidate participants (not admin)
  const candidateParticipants = Array.from(participants.values()).filter(
    (p) => p.displayName !== "Admin"
  );

  if (candidateParticipants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Video className="h-10 w-10 opacity-30" />
        <p className="text-sm">Waiting for candidates to join…</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {candidateParticipants.map((p) => {
        const sess = sessionMap[p.id];
        return (
          <CandidateTile
            key={p.id}
            participantId={p.id}
            name={sess?.candidate_name ?? p.displayName ?? p.id}
            warnings={sess?.warnings ?? 0}
            isSpeaking={speakingTo === p.id}
            onSpeak={() => setSpeakingTo(p.id)}
            onStopSpeak={() => setSpeakingTo(null)}
          />
        );
      })}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function LiveMonitoring() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);

  // Fetch token once
  useEffect(() => {
    getVideoSDKToken()
      .then(setToken)
      .finally(() => setLoadingToken(false));
  }, []);

  // Load exams that have an active meeting
  const loadExams = useCallback(async () => {
    const { data } = await supabase
      .from("exams")
      .select("id, name, meeting_id")
      .not("meeting_id", "is", null)
      .order("name");
    if (data) setExams(data as Exam[]);
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);

  // Load active sessions for selected exam
  const loadSessions = useCallback(async (examId: string) => {
    const { data } = await supabase
      .from("exam_sessions")
      .select("candidate_id, candidate_name, warnings")
      .eq("exam_id", examId)
      .eq("status", "active");
    if (data) setSessions(data as LiveSession[]);
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    loadSessions(selectedExamId);
    const ch = supabase
      .channel(`sessions_${selectedExamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_sessions" }, () => loadSessions(selectedExamId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedExamId, loadSessions]);

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const flagged = sessions.filter((s) => s.warnings > 0).length;

  return (
    <AdminLayout title="Live Monitoring">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedExamId} onValueChange={setSelectedExamId}>
            <SelectTrigger className="w-64 rounded-lg h-9">
              <SelectValue placeholder="Select an exam…" />
            </SelectTrigger>
            <SelectContent>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedExamId && (
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                {sessions.length} active
              </span>
              {flagged > 0 && <span className="text-destructive font-medium">{flagged} flagged</span>}
            </div>
          )}
        </div>

        {/* Content */}
        {!selectedExamId ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Video className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select an exam to start monitoring.</p>
          </div>
        ) : loadingToken ? (
          <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Connecting…
          </div>
        ) : token && selectedExam?.meeting_id ? (
          <MeetingProvider
            config={{
              meetingId: selectedExam.meeting_id,
              micEnabled: false,
              webcamEnabled: false,
              name: "Admin",
              debugMode: false,
            }}
            token={token}
            joinWithoutUserInteraction
          >
            <ExamRoom
              meetingId={selectedExam.meeting_id}
              token={token}
              sessions={sessions}
            />
          </MeetingProvider>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Video className="h-10 w-10 opacity-30" />
            <p className="text-sm">No active session for this exam yet.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
