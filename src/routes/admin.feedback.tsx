import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, Search } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Feedback } from "@/lib/supabase-types";

export const Route = createFileRoute("/admin/feedback")({
  head: () => ({ meta: [{ title: "Feedback — Proctor Admin" }] }),
  component: FeedbackPage,
});

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className="h-3.5 w-3.5"
          fill={s <= rating ? "var(--warning)" : "transparent"}
          stroke={s <= rating ? "var(--warning)" : "var(--muted-foreground)"}
        />
      ))}
    </div>
  );
}

const ratingLabel: Record<number, string> = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very Good", 5: "Excellent" };
const ratingTone: Record<number, string> = {
  1: "bg-destructive/10 text-destructive border-0",
  2: "bg-warning/10 text-warning-foreground border-0",
  3: "bg-muted text-muted-foreground border-0",
  4: "bg-primary/10 text-primary border-0",
  5: "bg-success/10 text-success border-0",
};

function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setFeedbacks(data as Feedback[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = feedbacks.filter((f) =>
    !search ||
    (f.candidate_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (f.exam_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (f.comment ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const avgRating = feedbacks.length
    ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
    : "—";

  const dist = [5, 4, 3, 2, 1].map((r) => ({
    star: r,
    count: feedbacks.filter((f) => f.rating === r).length,
    pct: feedbacks.length ? Math.round((feedbacks.filter((f) => f.rating === r).length / feedbacks.length) * 100) : 0,
  }));

  return (
    <AdminLayout title="Feedback">
      <div className="space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total responses</div>
              <div className="text-2xl font-semibold mt-1">{feedbacks.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Average rating</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-semibold">{avgRating}</span>
                <Star className="h-5 w-5" fill="var(--warning)" stroke="var(--warning)" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl col-span-2">
            <CardContent className="p-4 space-y-1.5">
              <div className="text-xs text-muted-foreground mb-2">Rating distribution</div>
              {dist.map((d) => (
                <div key={d.star} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-right text-muted-foreground">{d.star}</span>
                  <Star className="h-3 w-3 shrink-0" fill="var(--warning)" stroke="var(--warning)" />
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{d.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by candidate, exam or feedback…" className="pl-8 h-9 w-80 rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} responses</span>
        </div>

        {/* Table */}
        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id} className="hover:bg-accent/40 transition align-top">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 grid place-items-center text-xs font-medium shrink-0">
                          {(f.candidate_name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{f.candidate_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{f.candidate_id ?? ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.exam_name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <StarDisplay rating={f.rating} />
                        <Badge className={`text-[10px] ${ratingTone[f.rating] ?? ""}`}>{ratingLabel[f.rating]}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {f.comment ?? <span className="italic text-muted-foreground/60">No comment</span>}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(f.created_at).toLocaleDateString()}<br />
                      {new Date(f.created_at).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No feedback yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
