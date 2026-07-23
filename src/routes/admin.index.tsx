import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, CheckCircle2, TrendingUp, Award, AlertTriangle, Activity, ShieldAlert, Timer } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { AuditLog, ExamSession, Result } from "@/lib/supabase-types";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Proctor Admin" }] }),
  component: Dashboard,
});

type Stats = {
  totalCandidates: number;
  activeExams: number;
  completedExams: number;
  avgScore: number;
  highestScore: number;
  highestScoreName: string;
  lowestScore: number;
  todayExams: number;
  onlineCandidates: number;
  warnings24h: number;
  cheatingFlags: number;
};

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [liveSessions, setLiveSessions] = useState<ExamSession[]>([]);
  const [scoreByDay, setScoreByDay] = useState<{ d: string; exams: number; pass: number }[]>([]);
  const [avgByExam, setAvgByExam] = useState<{ m: string; score: number }[]>([]);

  const load = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    const [
      { count: totalCandidates },
      { data: examsData },
      { data: resultsData },
      { data: logs },
      { data: sessions },
      { count: warnings24h },
    ] = await Promise.all([
      supabase.from("candidates").select("*", { count: "exact", head: true }),
      supabase.from("exams").select("id, status, starts_at"),
      supabase.from("results").select("score, status, candidate_name, exam_name, created_at, warnings"),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("exam_sessions").select("*").eq("status", "live"),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).eq("severity", "warn").gte("created_at", yesterday),
    ]);

    const results = (resultsData ?? []) as Result[];
    const scores = results.map((r) => Number(r.score ?? 0));
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const highestScore = scores.length ? Math.max(...scores) : 0;
    const highestResult = results.find((r) => Number(r.score) === highestScore);
    const lowestScore = scores.length ? Math.min(...scores) : 0;

    const activeExams = (examsData ?? []).filter((e) => e.status === "Live").length;
    const completedExams = (examsData ?? []).filter((e) => e.status === "Completed").length;
    const todayExams = (examsData ?? []).filter((e) => e.starts_at && new Date(e.starts_at) >= today).length;
    const cheatingFlags = (resultsData ?? []).filter((r) => (r.warnings ?? 0) >= 3).length;

    setStats({
      totalCandidates: totalCandidates ?? 0,
      activeExams,
      completedExams,
      avgScore,
      highestScore,
      highestScoreName: highestResult?.candidate_name ?? "—",
      lowestScore,
      todayExams,
      onlineCandidates: (sessions ?? []).length,
      warnings24h: warnings24h ?? 0,
      cheatingFlags,
    });

    setRecentLogs((logs ?? []) as AuditLog[]);
    setLiveSessions((sessions ?? []) as ExamSession[]);

    // Score by day (last 14 days from results)
    const dayMap: Record<string, { exams: number; pass: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayMap[key] = { exams: 0, pass: 0 };
    }
    results.forEach((r) => {
      const key = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (dayMap[key]) {
        dayMap[key].exams++;
        if (r.status === "Pass") dayMap[key].pass++;
      }
    });
    setScoreByDay(Object.entries(dayMap).map(([d, v]) => ({ d, ...v })));

    // Avg score by exam
    const examMap: Record<string, number[]> = {};
    results.forEach((r) => {
      if (!r.exam_name) return;
      if (!examMap[r.exam_name]) examMap[r.exam_name] = [];
      examMap[r.exam_name].push(Number(r.score ?? 0));
    });
    setAvgByExam(
      Object.entries(examMap).slice(0, 8).map(([name, scores]) => ({
        m: name.length > 10 ? name.slice(0, 10) + "…" : name,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
    );
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime live sessions
  useEffect(() => {
    const ch = supabase.channel("sessions_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_sessions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const statCards = stats ? [
    { label: "Total Candidates", value: stats.totalCandidates.toLocaleString(), icon: Users, delta: "Registered" },
    { label: "Active Exams", value: stats.activeExams.toString(), icon: FileText, delta: "Running now" },
    { label: "Completed Exams", value: stats.completedExams.toString(), icon: CheckCircle2, delta: "All time" },
    { label: "Average Score", value: `${stats.avgScore}%`, icon: TrendingUp, delta: "Across all results" },
    { label: "Highest Score", value: `${stats.highestScore}%`, icon: Award, delta: stats.highestScoreName },
    { label: "Lowest Score", value: `${stats.lowestScore}%`, icon: AlertTriangle, delta: "All time" },
    { label: "Today's Exams", value: stats.todayExams.toString(), icon: Timer, delta: "Scheduled today" },
    { label: "Online Candidates", value: stats.onlineCandidates.toString(), icon: Activity, delta: "Live now" },
    { label: "Warnings (24h)", value: stats.warnings24h.toString(), icon: ShieldAlert, delta: "Last 24 hours" },
    { label: "Cheating Flags", value: stats.cheatingFlags.toString(), icon: ShieldAlert, delta: "≥3 warnings" },
  ] : [];

  const severityTone = (s: string | null) =>
    s === "danger" ? "bg-destructive/10 text-destructive border-0"
    : s === "warn" ? "bg-warning/10 text-warning-foreground border-0"
    : "bg-success/10 text-success border-0";

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className="rounded-xl transition hover:shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-2xl font-semibold tracking-tight mt-1">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{s.delta}</div>
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-accent grid place-items-center">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!stats && Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="rounded-xl animate-pulse">
              <CardContent className="p-4 h-20" />
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="rounded-xl lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Results per day · pass count</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={10} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="exams" name="Total" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pass" name="Pass" stroke="var(--success)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Avg score by exam</CardTitle></CardHeader>
            <CardContent className="h-72">
              {avgByExam.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgByExam}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={10} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Bar dataKey="score" name="Avg %" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No results yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity + Live sessions */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
            <CardContent className="divide-y divide-border">
              {recentLogs.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No activity yet</p>
              )}
              {recentLogs.map((a) => (
                <div key={a.id} className="py-3 flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-full bg-accent grid place-items-center text-xs font-medium shrink-0">
                    {(a.actor ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">
                      <span className="font-medium">{a.actor ?? "—"}</span>{" "}
                      <span className="text-muted-foreground">{a.event ?? ""}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleTimeString()}</div>
                  </div>
                  <Badge variant="secondary" className={severityTone(a.severity)}>
                    {a.severity ?? "info"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Live candidate sessions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {liveSessions.length === 0 && (
                <p className="text-sm text-muted-foreground">No live sessions right now</p>
              )}
              {liveSessions.map((s) => (
                <div key={s.candidate_id} className="flex items-center gap-3 text-sm p-3 rounded-lg border border-border hover:bg-accent/50 transition">
                  <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center text-xs font-medium">
                    {s.candidate_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{s.candidate_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Q {s.question_index + 1} / {s.total_questions} · {s.exam_name ?? "—"}
                    </div>
                  </div>
                  <Badge className={s.warnings > 0 ? "bg-destructive/10 text-destructive border-0" : "bg-success/10 text-success border-0"}>
                    {s.warnings > 0 ? `${s.warnings} warn` : "OK"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
