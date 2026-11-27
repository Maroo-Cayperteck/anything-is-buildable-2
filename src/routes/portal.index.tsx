import { createFileRoute, Link } from "@tanstack/react-router";
import { usePortalSnapshot } from "@/lib/use-profile";
import { DayAgenda } from "@/components/portal/DayAgenda";
import { LectureReminders } from "@/components/portal/LectureReminders";
export const Route = createFileRoute("/portal/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "يومي الدراسي — بوابة الطالب" }] }),
});
function Dashboard() {
  const { data: snap } = usePortalSnapshot();
  if (!snap) return <p>جارٍ تحميل يومك…</p>;
  const p = snap.profile;
  return (
    <div className="space-y-5">
      <DayAgenda snap={snap} />
      <LectureReminders snap={snap} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["/portal/info", "بياناتي"],
          ["/portal/grades", "الدرجات والمعدل"],
          ["/portal/documents", "الملفات"],
          ["/portal/courses", "المواد"],
        ].map(([to, label]) => (
          <Link
            key={to}
            to={to!}
            className="rounded-xl border bg-card p-4 text-center font-semibold text-primary"
          >
            {label}
          </Link>
        ))}
      </div>
      <details className="rounded-xl border bg-card p-4">
        <summary className="font-bold cursor-pointer">ملخص بياناتي الأكاديمية</summary>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {[
            ["المعدل التراكمي", p.cgpa != null ? Number(p.cgpa).toFixed(2) : "في الانتظار"],
            ["الساعات المكتسبة", p.earned_hours ?? "في الانتظار"],
            ["مواد خطتي", snap.enrollments.length],
            ["الحالة الرسمية", p.academic_status || "في الانتظار"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          اختيارات جدولك شخصية؛ المعدل والنتائج والبيانات الرسمية يُدخلها المسؤول.
        </p>
      </details>
      <section className="rounded-xl border bg-card p-4">
        <div className="flex justify-between">
          <h3 className="font-bold">آخر الإعلانات</h3>
          <Link to="/portal/events" className="text-primary text-sm">
            كل الإعلانات والفعاليات
          </Link>
        </div>
        {snap.announcements.slice(0, 3).map((a) => (
          <article key={a.id} className="border-t pt-3 mt-3">
            <h4 className="font-semibold">{a.title}</h4>
            <p className="text-sm text-muted-foreground">{a.body}</p>
          </article>
        ))}
        {!snap.announcements.length && (
          <p className="mt-3 text-sm text-muted-foreground">لا توجد إعلانات جديدة.</p>
        )}
      </section>
    </div>
  );
}
