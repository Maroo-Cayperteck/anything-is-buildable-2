import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cairoClock, daySchedule, addDays } from "@/lib/planning-utils";
import { savePersonalEvent } from "@/lib/planning.functions";
import { DAYS, KIND_LABEL } from "@/lib/portal-data";
import type { usePortalSnapshot } from "@/lib/use-profile";
type Snapshot = NonNullable<ReturnType<typeof usePortalSnapshot>["data"]>;
export function DayAgenda({ snap }: { snap: Snapshot }) {
  const [clock, setClock] = useState(() => cairoClock()),
    [date, setDate] = useState("");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setClock(cairoClock()), 30000);
    return () => clearInterval(t);
  }, []);
  const chosen = date || clock.date;
  const today = daySchedule(snap.timetable, snap.exceptions, chosen);
  const next = Array.from({ length: 8 }, (_, i) => {
    const d = addDays(clock.date, i);
    return daySchedule(snap.timetable, snap.exceptions, d).filter(
      (s) => i > 0 || s.endMinutes > clock.minutes,
    );
  }).flat()[0];
  const missing = snap.enrollments.filter((e) => !e.lectures.length);
  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-hero text-primary-foreground p-5 sm:p-7 shadow-elevated">
        <p className="text-sm opacity-85">
          أهلًا {snap.profile.full_name_ar.split(" ")[0]} · بتوقيت القاهرة
        </p>
        <h2 className="text-2xl font-bold mt-2">
          {next
            ? next.occurrenceDate === clock.date && next.startMinutes <= clock.minutes
              ? "محاضرتك الآن"
              : "محاضرتك القادمة"
            : "يومك الدراسي"}
        </h2>
        {next ? (
          <>
            <p className="text-xl font-semibold mt-3" dir="auto">
              {next.course}
            </p>
            <p className="mt-2">
              {next.occurrenceDate} · {next.startTime}–{next.endTime} · {next.room}
            </p>
            <p className="text-sm mt-1">
              {next.groupName} · {KIND_LABEL[next.kind]} {next.changeNote && `· ${next.changeNote}`}
            </p>
          </>
        ) : (
          <p className="mt-3">
            لا توجد محاضرات محددة خلال الأيام القادمة. راجع موادك وتوزيعك والمواعيد المنشورة.
          </p>
        )}
        <Link
          to="/portal/registration"
          className="inline-flex bg-white text-primary font-bold rounded-lg px-4 py-2 mt-5"
        >
          جدولي وموادي
        </Link>
      </div>
      {missing.length > 0 && (
        <p className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
          جدولك غير مكتمل: {missing.map((e) => e.courseCode).join("، ")}. قد تحتاج تحديد المجموعة أو
          لم تُنشر المواعيد بعد.
        </p>
      )}
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-bold text-lg">
            {chosen === clock.date ? "مواعيد النهارده" : "مواعيد اليوم المختار"}
          </h3>
          <label className="text-sm">
            اليوم{" "}
            <input
              aria-label="تاريخ عرض اليوم"
              type="date"
              className="border rounded-lg p-2"
              value={chosen}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="divide-y mt-3">
          {today.map((s) => (
            <article key={s.id + s.occurrenceDate} className="py-3">
              <div className="font-bold" dir="auto">
                {s.course}
              </div>
              <p className="text-sm">
                {s.startTime}–{s.endTime} · {s.room} · {KIND_LABEL[s.kind]}
              </p>
              {s.changeNote && <p className="text-sm text-primary">{s.changeNote}</p>}
            </article>
          ))}
          {!today.length && (
            <p className="py-5 text-muted-foreground">مفيش محاضرات محددة في اليوم ده.</p>
          )}
        </div>
        {snap.exceptions
          .filter((e) => e.occurrence_date === chosen)
          .map((e) => (
            <p className="bg-warning-soft rounded-lg p-3 text-sm mt-2" key={e.id}>
              {snap.timetable.find((s) => s.id === e.slot_id)?.course}:{" "}
              {e.cancelled
                ? "المحاضرة ملغاة لهذا اليوم"
                : `اتنقلت إلى ${e.replacement_date} ${e.start_time?.slice(0, 5)}`}{" "}
              {e.note && `— ${e.note}`}
            </p>
          ))}
        {snap.personalEvents
          .filter((e) => e.event_date === chosen)
          .map((e) => (
            <article key={e.id} className="bg-muted rounded-lg p-3 mt-3">
              <p className="font-bold">
                {e.title} <span className="text-xs font-normal">حدث شخصي</span>
              </p>
              <p className="text-sm">
                {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)} · {e.note}
              </p>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await savePersonalEvent({ data: { ...e, remove: true } });
                    await qc.invalidateQueries();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "تعذر الحذف");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                حذف الحدث الشخصي
              </Button>
            </article>
          ))}
      </div>
      <details className="rounded-xl border bg-card p-4">
        <summary className="font-bold cursor-pointer">إضافة مذاكرة أو حدث شخصي</summary>
        <form
          className="grid gap-3 sm:grid-cols-2 mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            setBusy(true);
            try {
              await savePersonalEvent({
                data: {
                  title: String(f.get("title")),
                  event_date: String(f.get("date")),
                  start_time: String(f.get("start")),
                  end_time: String(f.get("end")),
                  note: String(f.get("note")),
                },
              });
              form.reset();
              await qc.invalidateQueries();
              toast.success("تمت إضافة الحدث");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "تعذر الإضافة");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            العنوان
            <input
              aria-label="عنوان الحدث الشخصي"
              name="title"
              className="w-full border rounded-lg p-2"
              required
              maxLength={120}
            />
          </label>
          <label>
            التاريخ
            <input
              aria-label="تاريخ الحدث الشخصي"
              type="date"
              name="date"
              defaultValue={chosen}
              className="w-full border rounded-lg p-2"
              required
            />
          </label>
          <label>
            من
            <input
              aria-label="بداية الحدث الشخصي"
              type="time"
              name="start"
              className="w-full border rounded-lg p-2"
              required
            />
          </label>
          <label>
            إلى
            <input
              aria-label="نهاية الحدث الشخصي"
              type="time"
              name="end"
              className="w-full border rounded-lg p-2"
              required
            />
          </label>
          <label className="sm:col-span-2">
            ملاحظة
            <input
              aria-label="ملاحظة الحدث الشخصي"
              name="note"
              className="w-full border rounded-lg p-2"
              maxLength={500}
            />
          </label>
          <Button variant="brand" disabled={busy}>
            إضافة الحدث
          </Button>
        </form>
      </details>
    </section>
  );
}
