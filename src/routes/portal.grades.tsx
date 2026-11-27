import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Award, ChevronDown, Clock, GraduationCap, Info, Loader2, TrendingUp } from "lucide-react";
import { GradePill, StatCard } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { GPA_SCALE } from "@/lib/portal-data";
import { usePortalSnapshot } from "@/lib/use-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/grades")({
  head: () => ({
    meta: [
      { title: "النتائج والمعدل التراكمي — بوابة الطالب" },
      { name: "description", content: "السجل الأكاديمي ونتائج الفصول المعتمدة والمعدل التراكمي." },
    ],
  }),
  component: Grades,
});

function Grades() {
  const { data: snap, isLoading, isError, refetch } = usePortalSnapshot();
  const [scaleOpen, setScaleOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (isError || !snap) {
    return (
      <div className="space-y-4 rounded-xl border bg-card p-8 text-center">
        <p className="text-destructive">تعذر تحميل النتائج الأكاديمية.</p>
        <Button variant="outline" onClick={() => refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const p = snap.profile;
  const grades = snap.grades;
  const summaries = snap.gradeSummaries;

  const groupedBySemester = new Map<
    string,
    {
      semesterId: string;
      semesterName: string;
      yearName: string;
      rows: typeof grades;
      semesterGpa: number | null;
    }
  >();

  for (const g of grades) {
    const existing = groupedBySemester.get(g.semester_id) ?? {
      semesterId: g.semester_id,
      semesterName: g.semesterName,
      yearName: g.academicYearName,
      rows: [],
      semesterGpa: summaries.find((s) => s.semester_id === g.semester_id)?.semester_gpa ?? null,
    };
    existing.rows.push(g);
    groupedBySemester.set(g.semester_id, existing);
  }

  const termSections = Array.from(groupedBySemester.values());

  return (
    <div className="space-y-6">
      {p.cgpa == null && <p className="rounded-xl bg-info-soft p-4">المعدل والبيانات الرسمية في الانتظار لحين إدخالها من المسؤول. يمكنك استخدام جدولك وموادك الآن.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Award}
          label="المعدل التراكمي"
          value={p.cgpa != null ? <span className="text-danger">{Number(p.cgpa).toFixed(2)}</span> : "—"}
          sub={p.cgpa != null ? "/ 4.00" : undefined}
          tone="danger"
        />
        <StatCard icon={GraduationCap} label="المستوى الأكاديمي" value={p.resolvedLevelName || "—"} tone="gold" />
        <StatCard
          icon={Clock}
          label="الساعات المكتسبة"
          value={p.earned_hours ?? "—"}
          sub={p.earned_hours != null ? "ساعة" : undefined}
        />
        <StatCard icon={TrendingUp} label="الحالة الأكاديمية" value={p.academic_status || "مقيد"} tone="success" />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <button onClick={() => setScaleOpen((o) => !o)} className="flex w-full items-center gap-3 px-6 py-4 text-sm font-semibold">
          <Info className="h-4 w-4 text-primary" /> سلم التقديرات المرجعي
          <ChevronDown className={cn("mr-auto h-4 w-4 transition-transform", scaleOpen && "rotate-180")} />
        </button>
        {scaleOpen && (
          <div className="grid grid-cols-3 gap-2 border-t p-6 sm:grid-cols-5 lg:grid-cols-9">
            {GPA_SCALE.map(([g, pts, range]) => (
              <div key={g} className="rounded-lg border p-3 text-center">
                <GradePill grade={g} />
                <div className="mt-2 font-mono text-sm font-bold">{pts}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {range}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {termSections.length === 0 ? (
        <section className="rounded-xl border bg-card p-10 text-center shadow-card">
          <p className="text-sm font-medium text-foreground">لا توجد نتائج معتمدة منشورة حتى الآن.</p>
          <p className="mt-1 text-xs text-muted-foreground">ستظهر النتائج فور اعتمادها ونشرها من إدارة شؤون الطلاب.</p>
        </section>
      ) : (
        termSections.map((t) => (
          <section key={t.semesterId} className="overflow-hidden rounded-xl border bg-card shadow-card">
            <div className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
              <h3 className="text-lg font-bold">{t.semesterName}</h3>
              {t.yearName && <span className="rounded-full bg-secondary px-3 py-0.5 text-sm">{t.yearName}</span>}
              <span className="rounded-full bg-success-soft px-3 py-0.5 text-sm font-medium text-success">معلنة</span>
              {t.semesterGpa != null && (
                <span className="mr-auto rounded-full bg-muted px-4 py-1 text-sm text-muted-foreground">
                  المعدل الفصلي <span className="font-mono font-bold text-danger">{Number(t.semesterGpa).toFixed(2)}</span>
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr className="label-caps">
                    <th className="p-4 text-right">المقرر</th>
                    <th className="p-4">الساعات</th>
                    <th className="p-4">الدرجة</th>
                    <th className="p-4">التقدير</th>
                    <th className="p-4">النقاط</th>
                    <th className="p-4">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((c) => (
                    <tr key={c.id} className="border-t text-center">
                      <td className="p-4 text-right" dir="ltr" style={{ textAlign: "right" }}>
                        <div className="font-medium">
                          {c.courseCode} - {c.courseName}
                        </div>
                      </td>
                      <td className="p-4">{c.creditHours}</td>
                      <td className="p-4 font-mono">{c.marks != null ? Number(c.marks).toFixed(1) : "—"}</td>
                      <td className="p-4">{c.grade_letter ? <GradePill grade={c.grade_letter} /> : "—"}</td>
                      <td className="p-4 font-mono">{c.grade_points != null ? Number(c.grade_points).toFixed(2) : "—"}</td>
                      <td className="p-4">
                        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs text-success">
                          {c.status_label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
