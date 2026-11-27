import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cairoClock, daySchedule } from "@/lib/planning-utils";
import type { usePortalSnapshot } from "@/lib/use-profile";
type Snapshot = NonNullable<ReturnType<typeof usePortalSnapshot>["data"]>;
export function LectureReminders({ snap }: { snap: Snapshot }) {
  const key = "reminders:" + snap.profile.user_id;
  const [minutes, setMinutes] = useState(10),
    [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const value = localStorage.getItem(key);
    setEnabled(!!value);
    setMinutes(Number(value) || 10);
  }, [key]);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const clock = cairoClock();
      for (const s of daySchedule(snap.timetable, snap.exceptions, clock.date)) {
        const remaining = s.startMinutes - clock.minutes;
        if (remaining <= 0 || remaining > minutes) continue;
        const marker = `${key}:${clock.date}:${s.id}:${s.startTime}`;
        if (localStorage.getItem(marker)) continue;
        localStorage.setItem(marker, "1");
        toast.info(`بعد ${remaining} دقائق: ${s.course} — ${s.room}`);
        if ("Notification" in window && Notification.permission === "granted")
          try {
            new Notification("المحاضرة القادمة", {
              body: `${s.course} — ${s.startTime} — ${s.room}`,
            });
          } catch {
            /* in-app notification already displayed */
          }
      }
    };
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, [enabled, minutes, key, snap]);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant="outline"
          onClick={async () => {
            if (!enabled) {
              if ("Notification" in window && Notification.permission === "default")
                await Notification.requestPermission();
              localStorage.setItem(key, String(minutes));
            } else localStorage.removeItem(key);
            setEnabled(!enabled);
          }}
        >
          {enabled ? "إيقاف تذكير المحاضرات" : "تفعيل تذكير المحاضرات"}
        </Button>
        <label className="text-sm">
          قبل{" "}
          <select
            aria-label="دقائق التذكير"
            className="border rounded-lg p-2"
            value={minutes}
            onChange={(e) => {
              const n = Number(e.target.value);
              setMinutes(n);
              if (enabled) localStorage.setItem(key, String(n));
            }}
          >
            {[5, 10, 15, 30].map((n) => (
              <option key={n} value={n}>
                {n} دقائق
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        يعمل أثناء فتح صفحة يومك أو جدولك، بتوقيت القاهرة، ويأخذ الإلغاء والتعويض في الاعتبار. لا
        يرسل إشعارات بعد إغلاق الموقع.
      </p>
    </div>
  );
}
