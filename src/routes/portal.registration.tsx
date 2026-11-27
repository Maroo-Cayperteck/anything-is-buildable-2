import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePortalSnapshot } from "@/lib/use-profile";
import { DAYS, KIND_LABEL } from "@/lib/portal-data";
import { overlappingSlots } from "@/lib/schedule-utils";
import { PersonalPlanner } from "@/components/portal/PersonalPlanner";
import { ScheduleTools } from "@/components/portal/ScheduleTools";
import { ConflictAlternatives } from "@/components/portal/ConflictAlternatives";
import { LectureReminders } from "@/components/portal/LectureReminders";
export const Route = createFileRoute("/portal/registration")({
  validateSearch: (search: Record<string, unknown>): { review?: boolean } =>
    search["review"] === true ? { review: true } : {},
  component: Registration,
  head: () => ({ meta: [{ title: "جدولي وموادي — بوابة الطالب" }] }),
});
function Registration() {
  const { review } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [semesterId, setSemester] = useState<string>(),
    [base, setBase] = useState(false);
  const { data: snap, isLoading, isError, refetch } = usePortalSnapshot(semesterId);
  if (isLoading) return <p>جارٍ تجهيز جدولك…</p>;
  if (isError || !snap)
    return (
      <div>
        <p>تعذر تحميل جدولك</p>
        <Button onClick={() => refetch()}>إعادة المحاولة</Button>
      </div>
    );
  if (review) {
    return (
      <PersonalPlanner
        snap={snap}
        onConfirm={() => void navigate({ to: "/portal/registration", search: {}, replace: true })}
      />
    );
  }
  const slots = base ? snap.baseTimetable : snap.timetable;
  const conflicts = overlappingSlots(slots);
  const missing = snap.enrollments.filter((e) => !e.lectures.length);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <div>
          <h2 className="font-bold text-2xl">جدولي وموادي</h2>
          <p className="text-sm text-muted-foreground">
            جدولك الشخصي يتغير فورًا، والجدول الأساسي متاح دائمًا للمقارنة.
          </p>
        </div>
        <label>
          الفصل
          <select
            aria-label="اختيار الفصل الدراسي"
            className="block w-full border rounded-lg p-2"
            value={semesterId ?? snap.selectedSemester?.id ?? ""}
            onChange={(e) => setSemester(e.target.value)}
          >
            {snap.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.academic_years?.name} — {s.name_ar}
              </option>
            ))}
          </select>
        </label>
      </div>
      <PersonalPlanner snap={snap} />
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-lg">الجدول الأسبوعي</h3>
          <div className="flex gap-2">
            <Button variant={!base ? "brand" : "outline"} onClick={() => setBase(false)}>
              جدولي الشخصي
            </Button>
            <Button variant={base ? "brand" : "outline"} onClick={() => setBase(true)}>
              الأساسي لتوزيعي
            </Button>
          </div>
        </div>
        {base && (
          <p className="text-sm text-muted-foreground mb-3">
            مواعيد مجموعاتك المختارة من الجدول الأساسي قبل تعديلات المواعيد الشخصية.
          </p>
        )}
        {!!missing.length && (
          <p className="rounded-lg bg-warning-soft p-3 text-sm mb-3">
            مواعيد غير مكتملة: {missing.map((e) => e.courseCode).join("، ")}. حدّد توزيعك أو راجع
            الجدول الأساسي؛ لن نخترع مواعيد غير منشورة.
          </p>
        )}
        {conflicts.length > 0 && (
          <ConflictAlternatives snap={snap} slots={slots} conflicts={conflicts} />
        )}
        {!slots.length ? (
          <p className="py-5 text-muted-foreground">
            اختَر موادك وتوزيعك بالأعلى لعرض المواعيد. ويمكنك تصفح الجدول الأساسي الكامل حتى لو لا
            تعرف مجموعتك.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {DAYS.filter(([day]) => slots.some((s) => s.day === day)).map(([day, name]) => (
              <div key={day} className="rounded-xl border overflow-hidden">
                <h4 className="font-bold bg-muted p-3">{name}</h4>
                <div className="divide-y">
                  {slots
                    .filter((s) => s.day === day)
                    .map((s) => (
                      <article key={s.id} className="p-3">
                        <p className="font-bold" dir="auto">
                          {s.courseCode} — {s.course}
                        </p>
                        <p className="text-sm mt-1">
                          {s.startTime}–{s.endTime} · {s.room}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {KIND_LABEL[s.kind]} · {s.groupName}
                        </p>
                        {s.isPersonal && (
                          <span className="text-xs text-primary">
                            موعد شخصي معدّل · الأساسي {s.original.startTime}–{s.original.endTime}
                          </span>
                        )}
                      </article>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {!!snap.exceptions.length && (
        <section className="rounded-xl bg-warning-soft p-4">
          <h3 className="font-bold">إلغاءات وتعويضات بتاريخ محدد</h3>
          {snap.exceptions.map((e) => (
            <p className="text-sm mt-2" key={e.id}>
              {snap.timetable.find((s) => s.id === e.slot_id)?.courseCode} · {e.occurrence_date} ·{" "}
              {e.cancelled
                ? "إلغاء هذا اليوم"
                : `تعويض ${e.replacement_date} ${e.start_time?.slice(0, 5)}–${e.end_time?.slice(0, 5)}`}{" "}
              · {e.note}
            </p>
          ))}
        </section>
      )}
      <LectureReminders snap={snap} />
      <details className="rounded-xl border bg-card p-4">
        <summary className="font-bold cursor-pointer">
          تعديل موعد شخصي أو إرسال ملاحظة للمسؤول
        </summary>
        <div className="mt-4">
          <ScheduleTools snap={snap} />
        </div>
      </details>
    </div>
  );
}
