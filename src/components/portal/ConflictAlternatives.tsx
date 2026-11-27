import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { distributionFields } from "@/components/portal/DistributionSelect";
import { getPlanningCatalog, saveMyPlan } from "@/lib/planning.functions";
import { alternateDistributions } from "@/lib/planning-preview";
import { DAYS, KIND_LABEL } from "@/lib/portal-data";
import type { usePortalSnapshot } from "@/lib/use-profile";

type Snapshot = NonNullable<ReturnType<typeof usePortalSnapshot>["data"]>;
type Meeting = Snapshot["timetable"][number];

export function ConflictAlternatives({
  snap,
  slots,
  conflicts,
}: {
  snap: Snapshot;
  slots: Meeting[];
  conflicts: string[][];
}) {
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["planning-catalog"], queryFn: () => getPlanningCatalog() });
  const semesterId = snap.selectedSemester?.id;
  const levelId =
    q.data?.plans.find((p) => p.semester_id === semesterId)?.level_id ?? snap.profile.level_id;
  const items = snap.enrollments.flatMap((e) =>
    !e.courseId
      ? []
      : [
          {
            courseId: e.courseId,
            offeringId: e.offeringId,
            group_number: e.group_number,
            section_number: e.section_number,
            lab_number: e.lab_number,
          },
        ],
  );

  return (
    <section className="mb-4 space-y-2" aria-label="تعارضات الجدول">
      <h4 className="font-bold text-destructive">{conflicts.length} تعارض في الجدول</h4>
      {conflicts.map(([a, b]) => {
        const first = slots.find((s) => s.id === a);
        const second = slots.find((s) => s.id === b);
        if (!first || !second) return null;
        return (
          <details key={first.id + second.id} className="rounded-lg border bg-muted/40 p-3 text-sm">
            <summary className="cursor-pointer font-semibold">
              <bdi>{first.courseCode}</bdi> و<bdi>{second.courseCode}</bdi> ·{" "}
              {DAYS.find(([day]) => day === first.day)?.[1]} ·{" "}
              <bdi>
                {first.startTime}–{first.endTime}
              </bdi>{" "}
              /{" "}
              <bdi>
                {second.startTime}–{second.endTime}
              </bdi>
            </summary>
            <div className="space-y-3 pt-3">
              {[first, second].map((meeting) => (
                <p key={meeting.id}>
                  <bdi>{meeting.course}</bdi> · {KIND_LABEL[meeting.kind]} · {meeting.room}
                </p>
              ))}
              <h5 className="font-semibold">المواعيد البديلة المنشورة</h5>
              {q.isPending && <p>جارٍ تحميل البدائل…</p>}
              {q.isError && (
                <Button variant="outline" onClick={() => void q.refetch()}>
                  إعادة تحميل البدائل
                </Button>
              )}
              {q.data &&
                [first, second].map((meeting, index) => {
                  const enrolled = snap.enrollments.find((e) =>
                    e.lectures.some((s) => s.id === meeting.id),
                  );
                  const item = items.find((i) => i.courseId === enrolled?.courseId);
                  if (!item) return null;
                  const courseSlots = snap.timetable.filter(
                    (s) => s.courseCode === meeting.courseCode,
                  );
                  const options = alternateDistributions(
                    q.data!.slots.filter((s) => s.offering_id === item.offeringId),
                    item,
                    meeting,
                    index === 0 ? second.id : first.id,
                    courseSlots,
                    snap.timetable.filter((s) => s.courseCode !== meeting.courseCode),
                  );
                  return (
                    <div key={meeting.id} className="space-y-2">
                      <p className="font-medium">
                        <bdi>{meeting.courseCode}</bdi> · {KIND_LABEL[meeting.kind]}
                      </p>
                      {options.length === 0 && (
                        <p className="text-muted-foreground">مفيش بديل منشور يحل التعارض ده.</p>
                      )}
                      {options.map(({ choice, slot, changed }) => (
                        <div
                          key={slot.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-2"
                        >
                          <span>
                            {changed
                              .map(
                                (field) =>
                                  distributionFields.find(([key]) => key === field)?.[1] +
                                  " " +
                                  choice[field],
                              )
                              .join("، ")}{" "}
                            · {DAYS.find(([day]) => day === slot.day_of_week)?.[1]} ·{" "}
                            <bdi>
                              {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                            </bdi>
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || !semesterId || !levelId}
                            onClick={async () => {
                              if (!semesterId || !levelId) return;
                              setBusy(true);
                              try {
                                await saveMyPlan({
                                  data: {
                                    semesterId,
                                    levelId,
                                    items: items.map((i) =>
                                      i.courseId === item.courseId ? { ...i, ...choice } : i,
                                    ),
                                  },
                                });
                                await qc.invalidateQueries();
                                toast.success("تم حفظ الموعد البديل في جدولك الشخصي");
                              } catch (error) {
                                toast.error(
                                  error instanceof Error ? error.message : "تعذر حفظ البديل",
                                );
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            استخدم البديل
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          </details>
        );
      })}
    </section>
  );
}
