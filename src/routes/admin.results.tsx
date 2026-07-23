import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Search } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Result } from "@/lib/supabase-types";

export const Route = createFileRoute("/admin/results")({
  head: () => ({ meta: [{ title: "Results — Proctor Admin" }] }),
  component: Results,
});

const statusTone: Record<string, string> = {
  Pass: "bg-success/10 text-success border-0",
  Fail: "bg-destructive/10 text-destructive border-0",
  Terminated: "bg-warning/15 text-warning-foreground border-0",
};

function Results() {
  const [results, setResults] = useState<Result[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setResults(data as Result[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = results.filter((r) =>
    !search ||
    (r.candidate_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.exam_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Pie distribution from real data
  const pass = results.filter((r) => r.status === "Pass").length;
  const fail = results.filter((r) => r.status === "Fail").length;
  const terminated = results.filter((r) => r.status === "Terminated").length;
  const total = results.length || 1;

  const dist = [
    { name: "Pass", value: Math.round((pass / total) * 100), color: "var(--success)" },
    { name: "Fail", value: Math.round((fail / total) * 100), color: "var(--destructive)" },
    { name: "Terminated", value: Math.round((terminated / total) * 100), color: "var(--warning)" },
  ].filter((d) => d.value > 0);

  return (
    <AdminLayout title="Results">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search candidate or exam…" className="pl-8 h-9 w-72 rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="text-xs text-muted-foreground ml-1">{results.length} results</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="rounded-xl lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Results</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Warnings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.candidate_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.exam_name ?? "—"}</TableCell>
                      <TableCell className="font-mono">{r.score ?? 0}%</TableCell>
                      <TableCell className="text-muted-foreground">{r.time_taken ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={(r.warnings ?? 0) > 2 ? "bg-destructive/10 text-destructive border-0" : "bg-muted text-muted-foreground border-0"}>
                          {r.warnings ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusTone[r.status ?? "Fail"] ?? statusTone.Fail}>
                          {r.status ?? "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No results found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader><CardTitle className="text-base">Outcome distribution</CardTitle></CardHeader>
            <CardContent className="h-72">
              {dist.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie data={dist} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {dist.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                    {dist.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.name} · {d.value}%
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No results yet</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
