import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPasswordResetRequests,
  handlePasswordResetRequest,
} from "@/lib/password-recovery.functions";

export const Route = createFileRoute("/admin/password-requests")({
  component: PasswordRequests,
  head: () => ({ meta: [{ title: "طلبات كلمة المرور — بوابة المسؤول" }] }),
});

type Request = Awaited<ReturnType<typeof getPasswordResetRequests>>[number];

function PasswordRequests() {
  const requests = useQuery({
    queryKey: ["password-reset-requests"],
    queryFn: () => getPasswordResetRequests(),
    refetchInterval: 30_000,
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">طلبات استعادة كلمة المرور</h2>
          <p className="text-sm text-muted-foreground">
            تحقّق من هوية الطالب بوسيلة معروفة مسبقًا، ثم سلّمه كلمة المرور الجديدة بشكل خاص.
          </p>
        </div>
        <Button variant="outline" onClick={() => void requests.refetch()}>
          تحديث القائمة
        </Button>
      </div>
      {requests.isPending && <p>جارٍ تحميل الطلبات…</p>}
      {requests.isError && <p role="alert">تعذر تحميل الطلبات. جرّب تحديث القائمة.</p>}
      {requests.data?.length === 0 && <p>مفيش طلبات معلّقة.</p>}
      {requests.data?.map((entry) => (
        <RequestCard key={entry.id} entry={entry} refresh={() => requests.refetch()} />
      ))}
    </section>
  );
}

function RequestCard({ entry, refresh }: { entry: Request; refresh: () => Promise<unknown> }) {
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const claimed = !!entry.busy_until && Date.parse(entry.busy_until) > Date.now();
  async function act(password?: string) {
    setBusy(true);
    try {
      await handlePasswordResetRequest({
        data:
          password === undefined
            ? { id: entry.id, outcome: "dismissed" }
            : { id: entry.id, outcome: "reset", verifiedIdentity: true, password },
      });
      toast.success(password === undefined ? "تم إغلاق الطلب" : "تم تغيير كلمة المرور");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر معالجة الطلب");
    } finally {
      await refresh();
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="font-bold">
        {entry.student_profiles?.full_name_ar} · <bdi>{entry.student_profiles?.student_code}</bdi>
      </h3>
      <p className="text-sm text-muted-foreground">
        {new Intl.DateTimeFormat("ar-EG", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Africa/Cairo",
        }).format(new Date(entry.requested_at))}
      </p>
      {claimed && <p role="status">الطلب قيد المعالجة.</p>}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!verified || busy || claimed) return;
          const form = event.currentTarget;
          const password = new FormData(form).get("password");
          form.reset();
          if (typeof password === "string") void act(password);
        }}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
          />
          تحققت من هوية الطالب
        </label>
        <label className="block max-w-xs">
          كلمة المرور الجديدة
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            dir="ltr"
            disabled={!verified || busy || claimed}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="brand" disabled={!verified || busy || claimed}>
            تعيين كلمة المرور
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || claimed}
            onClick={() => void act()}
          >
            إغلاق الطلب من غير تغيير
          </Button>
        </div>
      </form>
    </article>
  );
}
