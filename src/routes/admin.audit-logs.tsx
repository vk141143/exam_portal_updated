import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Eye, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { AuditLog } from "@/lib/supabase-types";

export const Route = createFileRoute("/admin/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — Proctor Admin" }] }),
  component: AuditLogs,
});

const tone: Record<string, string> = {
  info: "bg-muted text-muted-foreground border-0",
  warn: "bg-warning/15 text-warning-foreground border-0",
  danger: "bg-destructive/10 text-destructive border-0",
};

const SevIcon = ({ s }: { s: string }) =>
  s === "danger" ? <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
  : s === "warn" ? <AlertTriangle className="h-3.5 w-3.5 text-warning-foreground shrink-0" />
  : <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;

type GroupedActor = {
  actor: string;
  total: number;
  warns: number;
  dangers: number;
  lastSeen: string;
  lastEvent: string;
  logs: AuditLog[];
};

function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GroupedActor | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setLogs(data as AuditLog[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("audit_logs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, (payload) => {
        setLogs((prev) => [payload.new as AuditLog, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Group by actor
  const grouped = useMemo<GroupedActor[]>(() => {
    const map = new Map<string, AuditLog[]>();
    for (const l of logs) {
      const key = l.actor ?? "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return Array.from(map.entries()).map(([actor, actorLogs]) => ({
      actor,
      total: actorLogs.length,
      warns: actorLogs.filter((l) => l.severity === "warn").length,
      dangers: actorLogs.filter((l) => l.severity === "danger").length,
      lastSeen: actorLogs[0].created_at,
      lastEvent: actorLogs[0].event ?? "",
      logs: actorLogs,
    }));
  }, [logs]);

  const filtered = grouped.filter((g) =>
    !search ||
    g.actor.toLowerCase().includes(search.toLowerCase()) ||
    g.logs.some((l) => (l.event ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  // When search matches, also filter the detail sheet logs
  const sheetLogs = selected
    ? (search
        ? selected.logs.filter((l) => (l.event ?? "").toLowerCase().includes(search.toLowerCase()))
        : selected.logs)
    : [];

  return (
    <AdminLayout title="Audit Logs">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Filter by candidate or event…" className="pl-8 h-9 w-72 rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="text-xs text-muted-foreground ml-2">{filtered.length} candidates · {logs.length} events</span>
        </div>

        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Last event</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Warnings</TableHead>
                  <TableHead>Violations</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g) => (
                  <TableRow key={g.actor} className="cursor-pointer hover:bg-accent/40" onClick={() => setSelected(g)}>
                    <TableCell className="font-medium">{g.actor}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(g.lastSeen).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate text-muted-foreground">{g.lastEvent}</TableCell>
                    <TableCell>
                      <Badge className="bg-muted text-muted-foreground border-0">{g.total}</Badge>
                    </TableCell>
                    <TableCell>
                      {g.warns > 0
                        ? <Badge className="bg-warning/15 text-warning-foreground border-0">⚠ {g.warns}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {g.dangers > 0
                        ? <Badge className="bg-destructive/10 text-destructive border-0">🛑 {g.dangers}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs gap-1.5" onClick={(e) => { e.stopPropagation(); setSelected(g); }}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No logs found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Event timeline sheet ── */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              {selected?.actor}
              <Badge className="bg-muted text-muted-foreground border-0 font-normal">{selected?.total} events</Badge>
              {(selected?.warns ?? 0) > 0 && <Badge className="bg-warning/15 text-warning-foreground border-0">⚠ {selected?.warns} warn</Badge>}
              {(selected?.dangers ?? 0) > 0 && <Badge className="bg-destructive/10 text-destructive border-0">🛑 {selected?.dangers} violation</Badge>}
            </SheetTitle>
          </SheetHeader>

          {/* Timeline */}
          <div className="relative pl-5 space-y-0">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            {sheetLogs.map((l, i) => (
              <div key={l.id ?? i} className="relative flex gap-3 pb-4">
                {/* dot */}
                <div className={`absolute -left-[1px] top-1 h-3 w-3 rounded-full border-2 border-background shrink-0
                  ${l.severity === "danger" ? "bg-destructive" : l.severity === "warn" ? "bg-warning" : "bg-muted-foreground/40"}`}
                />
                <div className="pl-4 flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <SevIcon s={l.severity ?? "info"} />
                    <span className="text-sm leading-snug flex-1">{l.event ?? "—"}</span>
                    <Badge className={`${tone[l.severity ?? "info"] ?? tone.info} shrink-0 text-[10px]`}>{l.severity ?? "info"}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    <span className="font-mono">{new Date(l.created_at).toLocaleString()}</span>
                    {l.ip_address && <span>IP: {l.ip_address}</span>}
                  </div>
                  {l.client && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{l.client}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
