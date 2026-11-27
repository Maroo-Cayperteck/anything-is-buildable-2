import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/portal/Shell";
import { registerWithStudentCode } from "@/lib/accounts.functions";
export const Route = createFileRoute("/register")({ ssr: false, component: Register });
function Register() {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="min-h-screen bg-login p-4 flex items-center justify-center" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl bg-card p-5 sm:p-10 shadow-elevated">
        <div className="text-center">
          <BrandMark className="mx-auto h-16 w-16" />
          <h1 className="text-2xl font-bold mt-5">حساب طالب جديد</h1>
          <p className="text-sm text-muted-foreground mt-2">
            رقمك الجامعي وكلمة مرور تختارها. التفعيل بعد مراجعة المسؤول، بدون بريد إلكتروني.
          </p>
        </div>
        {done ? (
          <div className="text-center space-y-4 mt-8">
            <CheckCircle2 className="mx-auto text-success" />
            <h2>تم إرسال طلبك للمراجعة</h2>
            <p>
              بعد الموافقة، ادخل بنفس الرقم الجامعي وكلمة المرور. المسؤول يراجع المستوى والمواد
              ويحدد جدولك.
            </p>
            <Button asChild variant="brand">
              <Link to="/">تسجيل الدخول</Link>
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4 mt-7"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setError("");
              if (f.get("password") !== f.get("confirm")) {
                setError("كلمتا المرور غير متطابقتين");
                return;
              }
              setBusy(true);
              try {
                await registerWithStudentCode({
                  data: {
                    studentCode: String(f.get("code")),
                    password: String(f.get("password")),
                    fullNameAr: String(f.get("name")),
                    level: Number(f.get("level")),
                    term: Number(f.get("term")),
                  },
                });
                setDone(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : "تعذر إرسال الطلب");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block">
              الرقم الجامعي
              <Input
                name="code"
                aria-label="الرقم الجامعي"
                dir="ltr"
                inputMode="numeric"
                autoComplete="username"
                placeholder="925250050"
                required
                maxLength={9}
              />
            </label>
            <label className="block">
              الاسم الكامل بالعربية
              <Input
                name="name"
                aria-label="الاسم الكامل بالعربية"
                autoComplete="name"
                required
                minLength={5}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                المستوى
                <select name="level" aria-label="المستوى" className="w-full border rounded-lg p-2">
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      Level {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                الترم
                <select name="term" aria-label="الترم" className="w-full border rounded-lg p-2">
                  <option value="1">الأول</option>
                  <option value="2">الثاني</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              المستوى حسب اللائحة: Level 0 إعدادي، ثم Level 1 و2 و3. المواد الإلزامية تُقترح
              تلقائيًا للمسؤول، والاختيارية يحددها عند الاعتماد.
            </p>
            <label className="block">
              كلمة المرور
              <Input
                name="password"
                aria-label="كلمة المرور"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                dir="ltr"
              />
            </label>
            <label className="block">
              تأكيد كلمة المرور
              <Input
                name="confirm"
                aria-label="تأكيد كلمة المرور"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                dir="ltr"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                {error}
              </p>
            )}
            <Button variant="brand" className="w-full min-h-12" disabled={busy}>
              <UserPlus className="h-4 w-4" />
              {busy ? "جارٍ الإرسال…" : "إرسال طلب التسجيل"}
            </Button>
            <p className="text-xs text-muted-foreground">
              نسيت كلمة المرور؟ تواصل مع المسؤول لإعادة تعيينها بعد التحقق من هويتك.
            </p>
            <Link to="/" className="block text-center text-primary text-sm">
              لدي حساب — تسجيل الدخول
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
