import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandMark } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/password-recovery.functions";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
  head: () => ({ meta: [{ title: "استعادة كلمة المرور — بوابة الطالب" }] }),
});

function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="min-h-screen bg-login p-4 grid place-items-center" dir="rtl">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 sm:p-8 shadow-elevated space-y-5">
        <BrandMark className="mx-auto" />
        <h1 className="text-center font-bold text-2xl">استعادة كلمة المرور</h1>
        {sent ? (
          <p role="status" className="rounded-lg bg-muted p-4">
            لو فيه حساب نشط بالرقم ده، طلبك هيوصل للمسؤول. تابع معاه عبر وسيلة التواصل المعروفة عندك
            عشان يتحقق من هويتك ويسلّمك كلمة المرور الجديدة.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy(true);
              setError("");
              try {
                await requestPasswordReset({ data: { code: String(form.get("code")) } });
                setSent(true);
              } catch {
                setError("تأكد من الرقم الجامعي، أو حاول مرة أخرى بعد قليل.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block">
              الرقم الجامعي
              <Input
                autoComplete="username"
                name="code"
                required
                maxLength={9}
                minLength={9}
                inputMode="numeric"
                dir="ltr"
              />
            </label>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit" variant="brand" className="w-full">
              {busy ? "جارٍ إرسال الطلب…" : "إرسال طلب للمسؤول"}
            </Button>
          </form>
        )}
        <Link to="/" className="block text-center text-primary hover:underline">
          العودة لتسجيل الدخول
        </Link>
      </div>
    </main>
  );
}
