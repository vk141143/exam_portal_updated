import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Proctor Admin" }] }),
  component: Reports,
});

const reports = [
  "Candidate Result",
  "Exam Result",
  "Question Analysis",
  "Difficulty Analysis",
  "Average Score",
  "Pass Percentage",
  "Violation Report",
  "Attendance Report",
];

function Reports() {
  return (
    <AdminLayout title="Reports">
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {reports.map((r) => (
          <Card key={r} className="rounded-xl transition hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="h-9 w-9 rounded-lg bg-accent grid place-items-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base pt-2">{r}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Export the latest {r.toLowerCase()} in your preferred format.</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg flex-1"><Download className="h-3.5 w-3.5 mr-1.5" /> PDF</Button>
                <Button variant="outline" size="sm" className="rounded-lg flex-1"><Download className="h-3.5 w-3.5 mr-1.5" /> Excel</Button>
                <Button variant="outline" size="sm" className="rounded-lg flex-1"><Download className="h-3.5 w-3.5 mr-1.5" /> CSV</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}
