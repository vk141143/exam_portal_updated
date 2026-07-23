import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Proctor Admin" }] }),
  component: Settings,
});

function Settings() {
  return (
    <AdminLayout title="Settings">
      <div className="grid lg:grid-cols-2 gap-4 max-w-5xl">
        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Organization</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Company name</Label><Input defaultValue="Proctor Systems" /></div>
            <div className="space-y-2"><Label>Logo URL</Label><Input placeholder="https://…" /></div>
            <div className="space-y-2"><Label>Support email</Label><Input defaultValue="support@proctor.io" /></div>
            <Button className="rounded-lg">Save changes</Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Exam defaults</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Row label="Enforce fullscreen" defaultChecked />
            <Row label="Require camera" defaultChecked />
            <Row label="Require microphone" defaultChecked />
            <Row label="Require location" defaultChecked />
            <Row label="Shuffle questions" defaultChecked />
            <Row label="Auto submit on timer end" defaultChecked />
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Session timeout (min)</Label><Input type="number" defaultValue={30} /></div>
            <div className="space-y-2"><Label>Warning limit before termination</Label><Input type="number" defaultValue={3} /></div>
            <Separator />
            <Row label="Enforce strong passwords" defaultChecked />
            <Row label="Rate limit login attempts" defaultChecked />
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Row label="Email login credentials" defaultChecked />
            <Row label="Email exam schedule" defaultChecked />
            <Row label="Email result summary" defaultChecked />
            <Row label="Notify admins on violations" defaultChecked />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Row({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
