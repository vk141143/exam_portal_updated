import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Upload, Download, Search, MoreHorizontal, KeyRound, Ban, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Candidate, Exam } from "@/lib/supabase-types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Proctor Admin" }] }),
  component: Candidates,
});

const emptyForm = { name: "", candidateId: "", email: "", mobile: "", dept: "", password: "", examId: "" };

function Candidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Candidate | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", mobile: "", dept: "", examId: "" });

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Candidate | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);

  const load = useCallback(async () => {
    const [{ data: cands }, { data: exs }] = await Promise.all([
      supabase.from("candidates").select("*").order("created_at", { ascending: false }),
      supabase.from("exams").select("id, name, status").order("created_at", { ascending: false }),
    ]);
    if (cands) setCandidates(cands as Candidate[]);
    if (exs) setExams(exs as Exam[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Add ──
  const setAdd = (k: string, v: string) => setAddForm((f) => ({ ...f, [k]: v }));

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.candidateId || !addForm.email || !addForm.password) {
      toast.error("Name, Candidate ID, Email and Password are required"); return;
    }
    setLoading(true);
    const { error } = await supabase.from("candidates").insert({
      id: addForm.candidateId, name: addForm.name, email: addForm.email,
      mobile: addForm.mobile || null, department: addForm.dept || null,
      password_hash: addForm.password, assigned_exam_id: addForm.examId || null, status: "Active",
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Candidate added");
    setAddForm(emptyForm); setAddOpen(false); load();
  };

  // ── Edit ──
  const openEdit = (c: Candidate) => {
    setEditTarget(c);
    setEditForm({ name: c.name, email: c.email, mobile: c.mobile ?? "", dept: c.department ?? "", examId: c.assigned_exam_id ?? "" });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setLoading(true);
    const { error } = await supabase.from("candidates").update({
      name: editForm.name, email: editForm.email,
      mobile: editForm.mobile || null, department: editForm.dept || null,
      assigned_exam_id: editForm.examId || null,
    }).eq("id", editTarget.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Candidate updated");
    setEditOpen(false); setEditTarget(null); load();
  };

  // ── Reset password ──
  const openReset = (c: Candidate) => { setResetTarget(c); setNewPassword(""); setResetOpen(true); };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !newPassword) { toast.error("Enter a new password"); return; }
    setLoading(true);
    const { error } = await supabase.from("candidates").update({ password_hash: newPassword }).eq("id", resetTarget.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password reset successfully");
    setResetOpen(false); setResetTarget(null);
  };

  // ── Toggle status ──
  const toggleStatus = async (c: Candidate) => {
    const newStatus = c.status === "Active" ? "Disabled" : "Active";
    const { error } = await supabase.from("candidates").update({ status: newStatus }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Candidate ${newStatus === "Active" ? "enabled" : "disabled"}`);
    load();
  };

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("candidates").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Candidate deleted");
    setDeleteTarget(null); load();
  };

  const examName = (id: string | null) => exams.find((e) => e.id === id)?.name ?? "—";
  const filtered = candidates.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Candidates">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search candidates…" className="pl-8 h-9 w-72 rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-lg h-9"><Upload className="h-4 w-4 mr-2" /> Import CSV</Button>
            <Button variant="outline" className="rounded-lg h-9"><Download className="h-4 w-4 mr-2" /> Export</Button>
            <Button className="rounded-lg h-9" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add candidate</Button>
          </div>
        </div>

        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Assigned Exam</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="hover:bg-accent/40 transition">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center text-xs font-medium">
                          {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.id}</TableCell>
                    <TableCell>{c.department ?? "—"}</TableCell>
                    <TableCell>{examName(c.assigned_exam_id)}</TableCell>
                    <TableCell>
                      <Badge className={c.status === "Active" ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openReset(c)}><KeyRound className="h-4 w-4 mr-2" /> Reset password</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus(c)}>
                            {c.status === "Active"
                              ? <><Ban className="h-4 w-4 mr-2" /> Disable</>
                              : <><CheckCircle className="h-4 w-4 mr-2" /> Enable</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(c)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No candidates found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add candidate</DialogTitle></DialogHeader>
          <form onSubmit={submitAdd} className="space-y-4">
            <div className="space-y-2"><Label>Full name</Label><Input placeholder="Sneha Rao" value={addForm.name} onChange={(e) => setAdd("name", e.target.value)} /></div>
            <div className="space-y-2"><Label>Candidate ID</Label><Input placeholder="STU10234" value={addForm.candidateId} onChange={(e) => setAdd("candidateId", e.target.value)} /></div>
            <div className="space-y-2"><Label>Email address</Label><Input type="email" placeholder="student@college.edu" value={addForm.email} onChange={(e) => setAdd("email", e.target.value)} /></div>
            <div className="space-y-2"><Label>Mobile number</Label><Input placeholder="+91 9876543210" value={addForm.mobile} onChange={(e) => setAdd("mobile", e.target.value)} /></div>
            <div className="space-y-2"><Label>Department</Label><Input placeholder="e.g. CSE" value={addForm.dept} onChange={(e) => setAdd("dept", e.target.value)} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" placeholder="••••••••" value={addForm.password} onChange={(e) => setAdd("password", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Assign exam</Label>
              <Select value={addForm.examId} onValueChange={(v) => setAdd("examId", v)}>
                <SelectTrigger><SelectValue placeholder="— No exam assigned —" /></SelectTrigger>
                <SelectContent>{exams.map((ex) => <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Adding…" : "Add candidate"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit candidate</DialogTitle></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2"><Label>Full name</Label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Email address</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Mobile number</Label><Input value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Department</Label><Input value={editForm.dept} onChange={(e) => setEditForm((f) => ({ ...f, dept: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Assign exam</Label>
              <Select value={editForm.examId} onValueChange={(v) => setEditForm((f) => ({ ...f, examId: v }))}>
                <SelectTrigger><SelectValue placeholder="— No exam assigned —" /></SelectTrigger>
                <SelectContent>{exams.map((ex) => <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reset password — {resetTarget?.name}</DialogTitle></DialogHeader>
          <form onSubmit={submitReset} className="space-y-4">
            <div className="space-y-2">
              <Label>New password</Label>
              <Input type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Resetting…" : "Reset password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the candidate and all their data. This action cannot be undone.</AlertDialogDescription>
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
