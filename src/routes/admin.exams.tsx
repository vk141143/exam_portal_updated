import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Calendar, Clock, Users, Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Exam } from "@/lib/supabase-types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/exams")({
  head: () => ({ meta: [{ title: "Exams — Proctor Admin" }] }),
  component: Exams,
});

const tone: Record<string, string> = {
  Live: "bg-success/10 text-success border-0",
  Scheduled: "bg-primary/10 text-primary border-0",
  Completed: "bg-muted text-muted-foreground border-0",
  Draft: "bg-warning/15 text-warning-foreground border-0",
};

const emptyForm = { name: "", subject: "", duration: "60", questions: "40", startDate: "", endDate: "", status: "Draft" };

function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

function genCode(name: string) {
  const slug = name.toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 12);
  return `${slug}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function Exams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Exam | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
    if (data) setExams(data as Exam[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setC = (k: string, v: string) => setCreateForm((f) => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm((f) => ({ ...f, [k]: v }));

  // ── Create ──
  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.subject) { toast.error("Title and subject are required"); return; }
    setLoading(true);
    const { error } = await supabase.from("exams").insert({
      name: createForm.name, subject: createForm.subject,
      duration_minutes: Number(createForm.duration), question_count: Number(createForm.questions),
      starts_at: createForm.startDate || null, ends_at: createForm.endDate || null,
      status: createForm.status, exam_code: genCode(createForm.name),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Exam created");
    setCreateForm(emptyForm); setCreateOpen(false); load();
  };

  // ── Edit ──
  const openEdit = (ex: Exam) => {
    setEditTarget(ex);
    setEditForm({
      name: ex.name, subject: ex.subject ?? "",
      duration: String(ex.duration_minutes), questions: String(ex.question_count),
      startDate: toDatetimeLocal(ex.starts_at), endDate: toDatetimeLocal(ex.ends_at),
      status: ex.status,
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setLoading(true);
    const { error } = await supabase.from("exams").update({
      name: editForm.name, subject: editForm.subject,
      duration_minutes: Number(editForm.duration), question_count: Number(editForm.questions),
      starts_at: editForm.startDate || null, ends_at: editForm.endDate || null,
      status: editForm.status,
    }).eq("id", editTarget.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Exam updated");
    setEditOpen(false); setEditTarget(null); load();
  };

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("exams").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Exam deleted");
    setDeleteTarget(null); load();
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success("Exam code copied"); };

  const FormFields = ({ form, set }: { form: typeof emptyForm; set: (k: string, v: string) => void }) => (
    <>
      <div className="space-y-2"><Label>Title</Label><Input placeholder="e.g. DBMS Mid-Term" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
      <div className="space-y-2"><Label>Subject</Label><Input placeholder="e.g. Database Systems" value={form.subject} onChange={(e) => set("subject", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" min={1} value={form.duration} onChange={(e) => set("duration", e.target.value)} /></div>
        <div className="space-y-2"><Label>No. of questions</Label><Input type="number" min={1} value={form.questions} onChange={(e) => set("questions", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Start date &amp; time</Label><Input type="datetime-local" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
        <div className="space-y-2"><Label>End date &amp; time</Label><Input type="datetime-local" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={form.status} onValueChange={(v) => set("status", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["Draft", "Scheduled", "Live", "Completed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <AdminLayout title="Exams">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Manage exams, schedules, and candidate assignments.</p>
          <Button className="rounded-lg h-9" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> Create exam</Button>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {exams.map((e) => (
            <Card key={e.id} className="rounded-xl transition hover:shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold truncate">{e.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{e.subject}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={tone[e.status] ?? ""}>{e.status}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md"><MoreVertical className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(e)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(e)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {e.duration_minutes} min</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {e.candidate_count}</div>
                  <div className="text-muted-foreground">{e.question_count} Qs</div>
                </div>
                {e.starts_at && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> {new Date(e.starts_at).toLocaleString()}
                  </div>
                )}
                {e.exam_code && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-mono text-muted-foreground">{e.exam_code}</span>
                    <button onClick={() => copyCode(e.exam_code!)} className="text-muted-foreground hover:text-foreground transition">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {exams.length === 0 && (
            <div className="col-span-3 text-center text-muted-foreground py-12">No exams yet. Create one to get started.</div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create exam</DialogTitle></DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <FormFields form={createForm} set={setC} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create exam"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit exam</DialogTitle></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <FormFields form={editForm} set={setE} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the exam and all associated questions. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
