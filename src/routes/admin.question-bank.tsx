import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Upload, Download, Search, Trash2, MoreVertical, Pencil } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Question, Exam } from "@/lib/supabase-types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/question-bank")({
  head: () => ({ meta: [{ title: "Question Bank — Proctor Admin" }] }),
  component: QuestionBank,
});

type QForm = { examId: string; question: string; options: string[]; correct: number; subject: string; difficulty: string; marks: string };
const emptyForm: QForm = { examId: "", question: "", options: ["Option A", "Option B", "Option C", "Option D"], correct: 0, subject: "", difficulty: "Medium", marks: "1" };

const diffColor: Record<string, string> = {
  Easy: "bg-success/10 text-success",
  Medium: "bg-warning/10 text-warning-foreground",
  Hard: "bg-destructive/10 text-destructive",
};

function OptionsEditor({ form, setField, setOption, addOption, removeOption }: {
  form: QForm;
  setField: (k: string, v: string | number) => void;
  setOption: (i: number, v: string) => void;
  addOption: () => void;
  removeOption: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Options <span className="text-xs text-muted-foreground">(select radio to mark correct)</span></Label>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addOption}><Plus className="h-3 w-3 mr-1" /> Add option</Button>
      </div>
      <div className="space-y-2">
        {form.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" checked={form.correct === i} onChange={() => setField("correct", i)} className="accent-primary h-4 w-4 shrink-0" />
            <span className="text-sm text-muted-foreground w-5 shrink-0">{String.fromCharCode(65 + i)}.</span>
            <Input value={opt} onChange={(e) => setOption(i, e.target.value)} className="h-8 flex-1" />
            {form.options.length > 2 && (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeOption(i)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Add
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<QForm>(emptyForm);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Question | null>(null);
  const [editForm, setEditForm] = useState<QForm>(emptyForm);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);

  const load = useCallback(async () => {
    const [{ data: qs }, { data: exs }] = await Promise.all([
      supabase.from("questions").select("*").order("created_at", { ascending: false }),
      supabase.from("exams").select("id, name").order("created_at", { ascending: false }),
    ]);
    if (qs) setQuestions(qs as Question[]);
    if (exs) setExams(exs as Exam[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Form helpers factory
  const makeHelpers = (setForm: React.Dispatch<React.SetStateAction<QForm>>) => ({
    setField: (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v })),
    setOption: (i: number, v: string) => setForm((f) => { const opts = [...f.options]; opts[i] = v; return { ...f, options: opts }; }),
    addOption: () => setForm((f) => ({ ...f, options: [...f.options, `Option ${String.fromCharCode(65 + f.options.length)}`] })),
    removeOption: (i: number) => setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i), correct: f.correct >= i ? Math.max(0, f.correct - 1) : f.correct })),
  });

  const addHelpers = makeHelpers(setAddForm);
  const editHelpers = makeHelpers(setEditForm);

  // ── Add ──
  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.examId || !addForm.question || addForm.options.length < 2) { toast.error("Exam, question and at least 2 options are required"); return; }
    setLoading(true);
    const { error } = await supabase.from("questions").insert({
      exam_id: addForm.examId, question_text: addForm.question, options: addForm.options,
      correct_option: addForm.correct, subject: addForm.subject || null,
      difficulty: addForm.difficulty, marks: Number(addForm.marks),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Question added");
    setAddForm(emptyForm); setAddOpen(false); load();
  };

  // ── Edit ──
  const openEdit = (q: Question) => {
    setEditTarget(q);
    setEditForm({
      examId: q.exam_id ?? "", question: q.question_text,
      options: Array.isArray(q.options) ? q.options : ["", "", "", ""],
      correct: q.correct_option ?? 0, subject: q.subject ?? "",
      difficulty: q.difficulty ?? "Medium", marks: String(q.marks ?? 1),
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setLoading(true);
    const { error } = await supabase.from("questions").update({
      exam_id: editForm.examId, question_text: editForm.question, options: editForm.options,
      correct_option: editForm.correct, subject: editForm.subject || null,
      difficulty: editForm.difficulty, marks: Number(editForm.marks),
    }).eq("id", editTarget.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Question updated");
    setEditOpen(false); setEditTarget(null); load();
  };

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("questions").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Question deleted");
    setDeleteTarget(null); load();
  };

  const examName = (id: string | null) => exams.find((e) => e.id === id)?.name ?? "—";
  const filtered = questions.filter((q) =>
    !search || q.question_text.toLowerCase().includes(search.toLowerCase()) || (q.subject ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const QFormBody = ({ form, helpers, examList }: { form: QForm; helpers: ReturnType<typeof makeHelpers>; examList: Exam[] }) => (
    <>
      <div className="space-y-2">
        <Label>Exam</Label>
        <Select value={form.examId} onValueChange={(v) => helpers.setField("examId", v)}>
          <SelectTrigger><SelectValue placeholder="— Select exam —" /></SelectTrigger>
          <SelectContent>{examList.map((ex) => <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Question</Label>
        <Textarea placeholder="Type your question here…" value={form.question} onChange={(e) => helpers.setField("question", e.target.value)} rows={3} />
      </div>
      <OptionsEditor form={form} setField={helpers.setField} setOption={helpers.setOption} addOption={helpers.addOption} removeOption={helpers.removeOption} />
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Subject</Label><Input placeholder="e.g. DBMS" value={form.subject} onChange={(e) => helpers.setField("subject", e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select value={form.difficulty} onValueChange={(v) => helpers.setField("difficulty", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["Easy", "Medium", "Hard"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Marks</Label><Input type="number" min={1} value={form.marks} onChange={(e) => helpers.setField("marks", e.target.value)} /></div>
      </div>
    </>
  );

  return (
    <AdminLayout title="Question Bank">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search questions, subjects…" className="pl-8 h-9 w-80 rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-lg h-9"><Upload className="h-4 w-4 mr-2" /> Import Excel</Button>
            <Button variant="outline" className="rounded-lg h-9"><Download className="h-4 w-4 mr-2" /> Export</Button>
            <Button className="rounded-lg h-9" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> New question</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((q) => {
            const opts: string[] = Array.isArray(q.options) ? q.options : [];
            return (
              <Card key={q.id} className="rounded-xl transition hover:shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span className="font-mono">{q.id.slice(0, 8)}</span>
                        <span>{q.subject}</span>
                      </div>
                      <CardTitle className="text-sm font-medium leading-snug">{q.question_text}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md shrink-0"><MoreVertical className="h-3.5 w-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(q)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(q)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {opts.map((o, i) => (
                      <div key={i} className={`rounded-md border border-border px-2 py-1.5 ${i === q.correct_option ? "bg-success/10 border-success/30 text-success" : ""}`}>
                        {String.fromCharCode(65 + i)}. {o}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="secondary" className={`rounded-md ${diffColor[q.difficulty ?? "Medium"] ?? ""}`}>{q.difficulty}</Badge>
                    <Badge variant="outline" className="rounded-md">{q.marks} mark{(q.marks ?? 1) > 1 ? "s" : ""}</Badge>
                    <div className="ml-auto text-xs text-muted-foreground truncate max-w-[100px]">{examName(q.exam_id)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center text-muted-foreground py-12">No questions found</div>
          )}
        </div>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add question</DialogTitle></DialogHeader>
          <form onSubmit={submitAdd} className="space-y-4">
            <QFormBody form={addForm} helpers={addHelpers} examList={exams} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Adding…" : "Add question"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit question</DialogTitle></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <QFormBody form={editForm} helpers={editHelpers} examList={exams} />
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
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.question_text.slice(0, 80)}…" will be permanently deleted.</AlertDialogDescription>
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
