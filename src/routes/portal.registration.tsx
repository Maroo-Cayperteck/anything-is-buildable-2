import {ScheduleTools} from "@/components/portal/ScheduleTools";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, CalendarDays, Loader2 } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { DAYS, KIND_LABEL, type SlotKind } from "@/lib/portal-data";
import { usePortalSnapshot } from "@/lib/use-profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/registration")({
  head: () => ({
    meta: [
      { title: "التسجيل الأكاديمي — بوابة الطالب" },
      { name: "description", content: "التسجيل الأكاديمي والجدول الأسبوعي المشتق من المجموعات المسجل بها الطالب." },
    ],
  }),
  component: Registration,
});

const KIND_CLS: Record<SlotKind, string> = {
  lecture: "bg-lecture text-primary-foreground",
  section: "bg-section text-foreground",
  lab: "bg-lab text-foreground",
};

function computeScheduleBounds(slots: { startMinutes: number; endMinutes: number }[]) {
  if (slots.length === 0) return { startHour: 8, endHour: 18 };
  const minMin = Math.min(...slots.map((s) => s.startMinutes));
  const maxMin = Math.max(...slots.map((s) => s.endMinutes));
  const startHour = Math.max(0, Math.min(8, Math.floor(minMin / 60)));
  const endHour = Math.min(24, Math.max(18, Math.ceil(maxMin / 60)));
  return { startHour, endHour };
}

function Registration() {
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
        <p className="text-destructive">تعذر تحميل بيانات التسجيل والجدول الدراسي.</p>
        <Button variant="outline" onClick={() => refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const p = snap.profile;
  const initial = p.full_name_ar[0] || "ط";
  const enrollments = snap.enrollments;
  const timetable = snap.timetable;
  const distinctGroups = [...new Set(enrollments.map((e) => e.groupName).filter(Boolean))];
  const { startHour, endHour } = computeScheduleBounds(timetable);
  const hours = Array.from({ length: Math.max(1, endHour - startHour) }, (_, i) => startHour + i);
  const totalMinutes = (endHour - startHour) * 60;

  return (
    <div className="space-y-6">
      <ScheduleTools snap={snap}/>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-sm text-warning">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          يُدار التسجيل وتوزيع المجموعات مركزيًا من إدارة شؤون الطلاب.
        </div>
        {snap.semesters.length > 0 && (
          <select
            aria-label="اختيار الفصل الدراسي"
            className="rounded-lg border bg-card px-3 py-1 text-foreground"
            value={semesterId ?? snap.selectedSemester?.id ?? ""}
            onChange={(e) => setSemesterId(e.target.value || undefined)}
          >
            {snap.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar} {s.is_current ? "(الحالي)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-4 border-b p-5">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {initial}
          </div>
          <div>
            <div className="font-semibold">{p.full_name_ar}</div>
            <div className="text-sm text-muted-foreground">
              الرقم الجامعي: <span className="font-mono">{p.student_code || "—"}</span>
              {p.cgpa != null ? ` · المعدل: ${Number(p.cgpa).toFixed(2)}` : ""}
            </div>
          </div>
          <span className="mr-auto rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            {p.academic_status || "التسجيل معتمد"}
          </span>
        </div>
        <div className="flex flex-wrap gap-8 bg-muted/50 px-6 py-4">
          {[
            ["المقررات المسجلة", enrollments.length, "text-foreground"],
            ["الفصل الدراسي", snap.selectedSemester?.name_ar ?? "—", "text-primary"],
            ["المجموعات", distinctGroups.length > 0 ? distinctGroups.join(" / ") : "—", "text-foreground"],
          ].map(([l, v, c]) => (
            <div key={l as string}>
              <div className="label-caps">{l}</div>
              <div className={cn("mt-1 font-mono font-bold", c as string)} dir="ltr">
                {v}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card
        title="الجدول الأسبوعي"
        icon={CalendarDays}
        action={
          <div className="flex gap-3 text-xs">
            {(Object.keys(KIND_LABEL) as SlotKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-sm", KIND_CLS[k])} /> {KIND_LABEL[k]}
              </span>
            ))}
          </div>
        }
      >
        {timetable.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            لا توجد حصص مجدولة في هذا الفصل الدراسي بعد.
          </p>
        ) : (
          <div className="-m-6 overflow-x-auto">
            <div className="min-w-[960px] text-xs" dir="ltr">
              <div className="grid border-b bg-muted/60" style={{ gridTemplateColumns: `96px repeat(${hours.length}, minmax(72px, 1fr))` }}>
                <div className="p-3 text-center font-semibold">اليوم</div>
                {hours.map((h) => (
                  <div key={h} className="border-l p-3 text-center font-semibold">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              <div className="divide-y">
                {DAYS.map(([day, ar]) => {
                  const slots = timetable.filter((s) => s.day === day);
                  return (
                    <div key={day} className="flex min-h-20 items-stretch">
                      <div className="flex w-24 shrink-0 items-center justify-center bg-muted/40 p-3 text-center font-semibold">
                        {ar}
                      </div>
                      <div className="relative flex-1 border-l">
                        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(72px, 1fr))` }}>
                          {hours.map((h) => (
                            <div key={h} className="min-h-20 border-l first:border-l-0" />
                          ))}
                        </div>
                        {slots.map((s) => {
                          const leftPct = Math.max(0, ((s.startMinutes - startHour * 60) / totalMinutes) * 100);
                          const widthPct = Math.max(4, ((s.endMinutes - s.startMinutes) / totalMinutes) * 100);
                          return (
                            <div
                              key={s.id}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              className="absolute inset-y-1 p-0.5"
                            >
                              <div className={cn("h-full overflow-hidden rounded-md p-2 leading-tight shadow-xs", KIND_CLS[s.kind])}>
                                <div className="truncate font-semibold">
                                  {KIND_LABEL[s.kind]} · {s.course}
                                </div>
                                <div className="mt-0.5 truncate font-mono text-[0.7rem] opacity-90">
                                  {s.startTime}–{s.endTime}
                                </div>
                                <div className="truncate opacity-80">
                                  {s.staff} · {s.room} ({s.groupName})
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
