import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { KIND_LABEL } from "@/lib/portal-data";
import { usePortalSnapshot } from "@/lib/use-profile";

export const Route = createFileRoute("/portal/courses")({
  head: () => ({
    meta: [
      { title: "المقررات الدراسية — بوابة الطالب" },
      { name: "description", content: "قائمة المقررات المسجلة للطالب من قاعدة البيانات." },
    ],
  }),
  component: Courses,
});

function Courses() {
  const [semesterId, setSemesterId] = useState<string | undefined>(undefined);
  const { data: snap, isLoading, isError, refetch } = usePortalSnapshot(semesterId);

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
        <p className="text-destructive">تعذر تحميل قائمة المقررات الدراسية.</p>
        <Button variant="outline" onClick={() => refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const enrollments = snap.enrollments;

  return (
    <Card
      title={`مواد خطتي (${enrollments.length})`}
      icon={BookOpen}
      action={
        snap.semesters.length > 0 ? (
          <select
            aria-label="اختيار الفصل الدراسي"
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            value={semesterId ?? snap.selectedSemester?.id ?? ""}
            onChange={(e) => setSemesterId(e.target.value || undefined)}
          >
            {snap.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar} {s.is_current ? "(الحالي)" : ""}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {enrollments.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          لا توجد مقررات مسجلة لك في هذا الفصل الدراسي حاليًا.
        </p>
      ) : (
        <div className="-m-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="label-caps">
                <th className="p-4 text-right">#</th>
                <th className="p-4 text-right">الكود</th>
                <th className="p-4 text-right">المقرر</th>
                <th className="p-4 text-right">المجموعة / السكشن</th>
                <th className="p-4 text-right">المحاضر</th>
                <th className="p-4 text-right">المكونات</th>
                <th className="p-4 text-center">الساعات المعتمدة</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((c, i) => {
                const kinds = [...new Set(c.lectures.map((l) => l.kind))];
                return (
                  <tr key={c.enrollmentId} className="border-t transition-colors hover:bg-muted/40">
                    <td className="p-4 text-muted-foreground">{i + 1}</td>
                    <td className="p-4 font-mono text-xs">{c.courseCode}</td>
                    <td className="p-4 font-medium" dir="ltr" style={{ textAlign: "right" }}>
                      {c.courseName}
                    </td>
                    <td className="p-4 font-mono text-xs" dir="ltr" style={{ textAlign: "right" }}>
                      {c.groupName || "—"}
                    </td>
                    <td className="p-4 text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>
                      {c.instructor || "—"}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {kinds.length > 0 ? (
                          kinds.map((k) => (
                            <span key={k} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                              {KIND_LABEL[k]}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono">{c.creditHours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
