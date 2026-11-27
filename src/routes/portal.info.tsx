import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, GraduationCap, Loader2, Save, ShieldCheck, UserRound } from "lucide-react";
import { Card, Field } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/lib/use-profile";
import { updateOwnContactInfo } from "@/lib/accounts.functions";

export const Route = createFileRoute("/portal/info")({
  head: () => ({
    meta: [
      { title: "بيانات الطالب — بوابة الطالب" },
      { name: "description", content: "البيانات الشخصية والأكاديمية وبيانات القيد للطالب." },
    ],
  }),
  component: Info,
});

function Info() {
  const p = useProfile();
  const qc = useQueryClient();
  const extra = (p.extra ?? {}) as Record<string, string>;
  const parts = p.full_name_ar.split(" ");
  const initials = parts[0]?.[0] || "ع";
  const [phone, setPhone] = useState(p.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const phoneDirty = (phone.trim() || null) !== (p.phone ?? null);

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    setSavingPhone(true);
    try {
      await updateOwnContactInfo({ data: { phone: phone.trim() } });
      await qc.invalidateQueries({ queryKey: ["portal-snapshot"] });
      toast.success("تم تحديث رقم الهاتف بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تحديث رقم الهاتف");
    } finally {
      setSavingPhone(false);
    }
  }

  return (
    <div className="space-y-6">
      {p.academic_status === "في الانتظار" && <p className="rounded-xl bg-info-soft p-4">بياناتك الأكاديمية الرسمية في الانتظار. يمكنك استخدام الجدول والمواد والملفات العامة الآن.</p>}
      <div className="flex items-center gap-6 rounded-2xl bg-hero p-8 text-primary-foreground shadow-elevated">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 border-primary-foreground/30 bg-primary-foreground/10 text-2xl font-bold">
          {initials}
        </div>
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{p.full_name_ar}</h2>
          <div className="mt-2 font-mono text-sm opacity-85">
            ID: {p.student_code || "—"} {p.full_name_en ? `· ${p.full_name_en}` : ""}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="البيانات الشخصية" icon={UserRound}>
          <div className="grid grid-cols-2 gap-6">
            <Field label="الاسم الأول" value={parts[0]} />
            <Field label="باقي الاسم" value={parts.slice(1).join(" ")} />
            <Field label="الاسم بالإنجليزية" value={p.full_name_en} />
            <Field label="الرقم القومي" value={p.national_id} mono />
            <Field label="النوع" value={p.gender} />
            <Field label="تاريخ الميلاد" value={extra["birth_date"]} />
            <Field label="البريد الإلكتروني" value={p.email} mono />
            <Field label="الهاتف" value={p.phone} mono />
          </div>

          <form onSubmit={savePhone} className="mt-6 flex flex-wrap items-end gap-3 border-t pt-4">
            <div className="flex-1 min-w-44">
              <label htmlFor="contact-phone" className="mb-1 block text-xs font-medium text-muted-foreground">
                تحديث رقم الهاتف (الحقل الشخصي المسموح بتعديله)
              </label>
              <Input
                id="contact-phone"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
              />
            </div>
            <Button type="submit" variant="brand" disabled={!phoneDirty || savingPhone}>
              {savingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الهاتف
            </Button>
          </form>
        </Card>

        <Card title="البيانات الأكاديمية" icon={GraduationCap}>
          <div className="grid grid-cols-2 gap-6">
            <Field label="الرقم الجامعي" value={p.student_code} mono />
            <Field label="اسم المستخدم" value={p.username} mono />
            <Field label="الكلية" value={p.resolvedFacultyName} />
            <Field label="البرنامج" value={p.resolvedProgramName} />
            <Field label="المستوى الأكاديمي" value={p.resolvedLevelName} />
            <Field label="العام الأكاديمي" value={p.resolvedYearName} />
            <Field
              label="الحالة الأكاديمية"
              value={<span className="rounded-full bg-success-soft px-2.5 py-0.5 text-sm text-success">{p.academic_status || "مقيد"}</span>}
            />
            <Field
              label="المعدل التراكمي"
              value={p.cgpa != null ? Number(p.cgpa).toFixed(2) : "—"}
              mono
            />
          </div>
        </Card>
      </div>

      <Card title="بيانات القيد" icon={ClipboardCheck}>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="رقم طلب الالتحاق" value={extra["application_no"]} mono />
          <Field label="المؤهل" value={extra["certificate"]} />
          <Field label="الساعات المكتسبة" value={p.earned_hours} />
        </div>
      </Card>

      <Card title="الأمان وشؤون الطلاب" icon={ShieldCheck}>
        <p className="text-sm text-muted-foreground">
          البيانات الأكاديمية والرسمية تُدار مركزيًا من إدارة شؤون الطلاب. لتعديل البيانات الرسمية يرجى مراجعة{" "}
          <a
            href="https://www.facebook.com/HNU.Helwan"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline"
          >
            الصفحة الرسمية لجامعة حلوان الأهلية
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
