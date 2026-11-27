import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DAYS } from "@/lib/portal-data";
import { usePortalSnapshot } from "@/lib/use-profile";
import {
  getMyScheduleChanges,
  saveScheduleOverride,
  sendScheduleRequest,
} from "@/lib/scheduling.functions";
import { overlappingSlots } from "@/lib/schedule-utils";
type Snapshot = NonNullable<ReturnType<typeof usePortalSnapshot>["data"]>;
export function ScheduleTools({ snap }: { snap: Snapshot }) {
  const qc = useQueryClient(),
    [editing, setEditing] = useState(""),
    [busy, setBusy] = useState(false);
  const requests = useQuery({
    queryKey: ["my-schedule-requests"],
    queryFn: () => getMyScheduleChanges(),
    refetchInterval: 60000,
  });
  const conflicts = overlappingSlots(snap.timetable);
  const slot = snap.timetable.find((x) => x.id === editing);
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="font-bold text-lg">تخصيص المواعيد والملاحظات</h2>
      <p className="text-sm text-muted-foreground">
        غيّر مواعيد نسختك بحرية، أو ارجع للموعد الأساسي. لتغيير الجروب أو السيكشن تلقائيًا استخدم
        اختيار موادي بالأعلى. تعديلك لا يغير جداول الآخرين.
      </p>
      {conflicts.length > 0 && (
        <p role="alert" className="text-destructive">
          يوجد {conflicts.length} تعارض في جدولك الحالي؛ راجع التعديلات أو أرسل طلبًا للمسؤول.
        </p>
      )}
      <div className="space-y-2">
        {snap.timetable.map((x) => (
          <div
            key={x.id}
            className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3"
          >
            <div className="min-w-0">
              <p className="font-medium break-words" dir="auto">
                {x.course}
              </p>
              <p className="text-sm text-muted-foreground">
                {DAYS.find((d) => d[0] === x.day)?.[1]} · {x.startTime}–{x.endTime} · {x.room}
                {x.isPersonal ? " · تعديل شخصي" : x.isAdminOverride ? " · تعديل المسؤول" : ""}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(editing === x.id ? "" : x.id)}
            >
              تعديل شخصي
            </Button>
          </div>
        ))}
      </div>
      {slot && (
        <form
          key={slot.id}
          className="rounded-lg bg-muted p-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await saveScheduleOverride({
                data: {
                  slotId: slot.id,
                  reset: false,
                  day_of_week: String(f.get("day")) as "Saturday",
                  start_time: String(f.get("start")),
                  end_time: String(f.get("end")),
                  location: String(f.get("room")),
                },
              });
              await qc.invalidateQueries({ queryKey: ["portal-snapshot"] });
              await qc.invalidateQueries({ queryKey: ["student-portal-snapshot"] });
              setEditing("");
              toast.success("حُفظ التعديل الشخصي");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>{slot.course}</h3>
          <div className="grid grid-cols-2 gap-3">
            <label>
              اليوم
              <select
                aria-label="اليوم الشخصي"
                name="day"
                className="w-full p-2 rounded border"
                defaultValue={slot.day}
              >
                {DAYS.map(([v, n]) => (
                  <option value={v} key={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              القاعة
              <input
                name="room"
                aria-label="القاعة الشخصية"
                className="w-full p-2 rounded border"
                defaultValue={slot.room}
                required
              />
            </label>
            <label>
              من
              <input
                aria-label="بداية الموعد الشخصي"
                name="start"
                className="w-full p-2 rounded border"
                type="time"
                defaultValue={slot.startTime}
                required
              />
            </label>
            <label>
              إلى
              <input
                name="end"
                aria-label="نهاية الموعد الشخصي"
                className="w-full p-2 rounded border"
                type="time"
                defaultValue={slot.endTime}
                required
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" disabled={busy}>
              حفظ التعديل الشخصي
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await saveScheduleOverride({
                    data: {
                      slotId: slot.id,
                      reset: true,
                      day_of_week: slot.day as "Saturday",
                      start_time: slot.startTime,
                      end_time: slot.endTime,
                      location: slot.room,
                    },
                  });
                  await qc.invalidateQueries();
                  setEditing("");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "تعذر الإلغاء");
                }
              }}
            >
              الرجوع للموعد الأساسي
            </Button>
          </div>
        </form>
      )}
      <form
        className="space-y-3 border-t pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
          try {
            await sendScheduleRequest({
              data: { message: String(new FormData(form).get("message")) },
            });
            form.reset();
            await requests.refetch();
            toast.success("وصل طلبك للمسؤول");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "تعذر الإرسال");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          ملاحظة أو طلب مساعدة
          <textarea
            aria-label="ملاحظة أو طلب مساعدة"
            name="message"
            placeholder="اكتب المادة والجروب أو الموعد المطلوب وسبب التعديل"
            className="block w-full border rounded-lg p-3 mt-1"
            minLength={5}
            maxLength={2000}
            required
          />
        </label>
        <Button variant="brand" disabled={busy}>
          إرسال للمسؤول
        </Button>
      </form>
      {requests.data?.map((r) => (
        <article key={r.id} className="border rounded-lg p-3 text-sm">
          <p>{r.message}</p>
          <p className="text-muted-foreground mt-1">
            {r.status === "pending"
              ? "قيد المراجعة"
              : r.status === "resolved"
                ? "تمت المعالجة"
                : "لم يُقبل الطلب"}{" "}
            {r.admin_reply && `— رد المسؤول: ${r.admin_reply}`}
          </p>
        </article>
      ))}
    </section>
  );
}
