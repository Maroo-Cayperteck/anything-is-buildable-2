import { resetMyPlan } from "@/lib/planning.functions";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPlanningCatalog, saveMyPlan, applyRosterPlan } from "@/lib/planning.functions";
import { readPlanItems, suggestedCodes, type PlanItem } from "@/lib/planning-utils";
import { DistributionSelect, distributionFields } from "@/components/portal/DistributionSelect";
import { findPlanningOffering, fullChoice } from "@/lib/planning-preview";
import { matchesChoice, type ScheduleChoice } from "@/lib/schedule-utils";
import { DAYS, KIND_LABEL } from "@/lib/portal-data";
import type { usePortalSnapshot } from "@/lib/use-profile";
type Snapshot = NonNullable<ReturnType<typeof usePortalSnapshot>["data"]>;
type Catalog = Awaited<ReturnType<typeof getPlanningCatalog>>;
const selectClass = "w-full min-w-0 rounded-lg border bg-background p-2";
type PlannerProps = { snap: Snapshot; onConfirm?: (() => void) | undefined };
export function PersonalPlanner({ snap, onConfirm }: PlannerProps) {
  const q = useQuery({ queryKey: ["planning-catalog"], queryFn: () => getPlanningCatalog() });
  if (q.isError)
    return (
      <p role="alert">
        تعذر تحميل خيارات الجدول. <Button onClick={() => q.refetch()}>إعادة المحاولة</Button>
      </p>
    );
  if (!q.data) return <p>جارٍ تجهيز خيارات الجدول…</p>;
  return (
    <Planner
      key={
        snap.selectedSemester?.id +
        String(q.data.plans.find((p) => p.semester_id === snap.selectedSemester?.id)?.updated_at)
      }
      snap={snap}
      onConfirm={onConfirm}
      c={q.data}
    />
  );
}
function Planner({ snap, c, onConfirm }: PlannerProps & { c: Catalog }) {
  const qc = useQueryClient();
  const semesterId = snap.selectedSemester?.id ?? "";
  const saved = c.plans.find((p) => p.semester_id === semesterId);
  const [levelId, setLevel] = useState(
    saved?.level_id ?? snap.profile.level_id ?? c.levels[0]?.id ?? "",
  );
  const [mode, setMode] = useState<"standard" | "custom">("standard"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [masterLevel, setMasterLevel] = useState(levelId);
  const initial = saved
    ? readPlanItems(saved.items)
    : snap.enrollments
        .filter((e) => e.courseId)
        .map((e) => ({
          courseId: e.courseId!,
          offeringId: e.offeringId,
          group_number: e.group_number,
          section_number: e.section_number,
          lab_number: e.lab_number,
        }));
  const [items, setItems] = useState<PlanItem[]>(initial);
  const [distribution, setDistribution] = useState({
    group_number: initial[0]?.group_number ?? null,
    section_number: initial[0]?.section_number ?? null,
    lab_number: initial[0]?.lab_number ?? null,
  });
  const term = c.semesters.find((s) => s.id === semesterId)?.season === "SPRING" ? 2 : 1;
  const defaults = (id: string) =>
    c.courses
      .filter((x) =>
        suggestedCodes(c.levels.find((l) => l.id === id)?.level_number ?? 0, term).includes(x.code),
      )
      .map((x) => ({ courseId: x.id, ...distribution }));
  const setChoice = (key: keyof ScheduleChoice, value: number | null) => {
    const next = { ...distribution, [key]: value };
    setDistribution(next);
    setItems((xs) => xs.map((x) => ({ ...x, [key]: next[key] })));
  };
  const refresh = () => qc.invalidateQueries();
  const programId = c.levels.find((level) => level.id === levelId)?.program_id;
  const semesterOfferings = c.offerings.filter(
    (o) => o.semester_id === semesterId && o.program_id === programId,
  );
  const levelSlots = c.slots.filter((slot) =>
    semesterOfferings.some((o) => o.id === slot.offering_id && o.level_id === levelId),
  );
  const slotsForItem = (item: PlanItem) => {
    const offering = findPlanningOffering(semesterOfferings, item, levelId);
    return c.slots.filter((slot) => slot.offering_id === offering?.id);
  };
  const draft = onConfirm
    ? items.flatMap((item) =>
        slotsForItem(item)
          .filter((slot) => matchesChoice(slot, fullChoice(item)))
          .map((slot) => ({
            ...slot,
            course: c.courses.find((course) => course.id === item.courseId),
          })),
      )
    : [];
  const firstDay = DAYS.find(([day]) => draft.some((slot) => slot.day_of_week === day));
  const masterOfferings = c.offerings.filter(
    (o) => o.semester_id === semesterId && o.level_id === masterLevel,
  );
  const masterSlots = c.slots
    .filter((s) => masterOfferings.some((o) => o.id === s.offering_id))
    .sort(
      (a, b) =>
        DAYS.findIndex((d) => d[0] === a.day_of_week) -
          DAYS.findIndex((d) => d[0] === b.day_of_week) || a.start_time.localeCompare(b.start_time),
    );
  return (
    <div className="space-y-4">
      {onConfirm && (
        <header>
          <h2 className="text-2xl font-bold">راجع أول جدول ليك</h2>
          <p className="text-sm text-muted-foreground">
            {snap.selectedSemester?.name_ar} · راجع المواد والتوزيع، وبعدها اضغط «ده جدولي».
          </p>
        </header>
      )}
      <details
        className="rounded-xl border bg-card p-4"
        open={!!onConfirm || snap.enrollments.length === 0 || !snap.timetable.length}
      >
        <summary className="cursor-pointer font-bold">
          {onConfirm ? "المواد المقترحة والتوزيع" : "اختيار موادي والجروب والسيكشن واللاب"}
        </summary>
        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            عدّل توزيعك وقت ما تحتاج. تغيير الجروب يجلب مواعيده تلقائيًا، وتقدر تخصص كل مادة. بيانات
            المعدل والدرجات لا تتغير.
          </p>
          <label className="block">
            مستواي
            <select
              aria-label="مستواي"
              className={selectClass}
              value={levelId}
              onChange={(e) => {
                setLevel(e.target.value);
                setItems(defaults(e.target.value));
              }}
            >
              {c.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name_ar}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={mode === "standard" ? "brand" : "outline"}
              onClick={() => setMode("standard")}
            >
              خطة الفصل العادية
            </Button>
            <Button
              variant={mode === "custom" ? "brand" : "outline"}
              onClick={() => setMode("custom")}
            >
              موادي مختلفة
            </Button>
            <Button variant="outline" onClick={() => setItems(defaults(levelId))}>
              اقتراح مواد المستوى
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {distributionFields.map((field) => (
              <DistributionSelect
                key={field[0]}
                field={field}
                slots={levelSlots}
                choice={distribution}
                name={field[1] + " لكل المواد"}
                onChange={(value) => setChoice(field[0], value)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            الاختيارات من مواعيد المستوى والترم. لو مش عارف توزيعك اختَر «لا أعرف»، ولو رقمك مش ظاهر
            اختَر «اختيار مخصص».
          </p>
          {mode === "custom" && (
            <>
              <input
                aria-label="البحث عن مادة"
                placeholder="ابحث بالكود أو اسم المادة"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={selectClass}
              />
              <div className="max-h-56 overflow-y-auto border rounded-lg p-2">
                {c.courses
                  .filter((x) =>
                    (x.code + " " + x.name).toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((course) => (
                    <label className="flex gap-2 py-2 border-b" key={course.id}>
                      <input
                        type="checkbox"
                        checked={items.some((x) => x.courseId === course.id)}
                        onChange={(e) =>
                          setItems((xs) =>
                            e.target.checked
                              ? [...xs, { courseId: course.id, ...distribution }]
                              : xs.filter((x) => x.courseId !== course.id),
                          )
                        }
                      />
                      <span dir="auto">
                        {course.code} — {course.name} ({course.credit_hours} س)
                      </span>
                    </label>
                  ))}
              </div>
            </>
          )}
          <p className="font-bold">
            {items.length} مواد ·{" "}
            {items.reduce(
              (n, x) => n + (c.courses.find((y) => y.id === x.courseId)?.credit_hours ?? 0),
              0,
            )}{" "}
            ساعة
          </p>
          <ul className="space-y-2">
            {items.map((item) => {
              const course = c.courses.find((x) => x.id === item.courseId);
              return (
                <li key={item.courseId} className="rounded-lg bg-muted/40 p-3">
                  <p dir="auto">
                    {course?.code} — {course?.name}
                  </p>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer">توزيع مختلف لهذه المادة</summary>
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      {distributionFields.map((field) => (
                        <DistributionSelect
                          key={field[0]}
                          field={field}
                          slots={slotsForItem(item)}
                          choice={fullChoice(item)}
                          name={field[1] + " " + (course?.code ?? "")}
                          onChange={(value) =>
                            setItems((xs) =>
                              xs.map((x) =>
                                x.courseId === item.courseId ? { ...x, [field[0]]: value } : x,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          {onConfirm && (
            <section
              className="rounded-lg border bg-muted/40 p-3 space-y-2"
              aria-label="معاينة أول يوم"
            >
              <h3 className="font-bold">أول يوم في الجدول{firstDay ? " · " + firstDay[1] : ""}</h3>
              {firstDay ? (
                draft
                  .filter((slot) => slot.day_of_week === firstDay[0])
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((slot) => (
                    <p key={slot.id} className="text-sm">
                      <bdi>
                        {slot.course?.code} — {slot.course?.name}
                      </bdi>{" "}
                      · {KIND_LABEL[slot.kind]} ·{" "}
                      <bdi>
                        {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                      </bdi>{" "}
                      · {slot.location}
                    </p>
                  ))
              ) : (
                <p className="text-sm">
                  مفيش مواعيد مطابقة لسه. اختَر التوزيع أو كمّل وراجعه بعدين.
                </p>
              )}
            </section>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="brand"
              disabled={busy || !items.length}
              onClick={async () => {
                setBusy(true);
                try {
                  await saveMyPlan({ data: { levelId, semesterId, items } });
                  await refresh();
                  toast.success("اتحفظت موادك وتوزيعك");
                  onConfirm?.();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {onConfirm ? "ده جدولي" : "حفظ موادي وتوزيعي"}
            </Button>
            {!onConfirm && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await applyRosterPlan({ data: { semesterId } });
                    if (!result[0]?.ok) throw new Error(result[0]?.message);
                    await refresh();
                    toast.success("تم تطبيق توزيع الكشف");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "تعذر تحميل الكشف");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                استخدام توزيع كشف المسؤول
              </Button>
            )}
          </div>
        </div>
      </details>
      {!onConfirm && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await resetMyPlan({ data: { semesterId } });
              await refresh();
              toast.success("تم الرجوع لخطة المسؤول");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "تعذر الرجوع");
            } finally {
              setBusy(false);
            }
          }}
        >
          الرجوع لمواد وتوزيع المسؤول إن وُجد
        </Button>
      )}
      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer font-bold">الجدول الأساسي الكامل — كل المجموعات</summary>
        <label className="block mt-3">
          المستوى المعروض
          <select
            aria-label="مستوى الجدول الأساسي"
            className={selectClass}
            value={masterLevel}
            onChange={(e) => setMasterLevel(e.target.value)}
          >
            {c.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name_ar}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground my-3">
          هذه مواعيد الفصل المختار كما سجلها المسؤول، مستقلة عن تعديلاتك الشخصية.
        </p>
        {!masterSlots.length && <p>لا توجد مواعيد منشورة لهذا المستوى والفصل بعد.</p>}
        <div className="max-h-[32rem] overflow-y-auto space-y-2">
          {masterSlots.map((s) => {
            const o = c.offerings.find((o) => o.id === s.offering_id),
              course = c.courses.find((x) => x.id === o?.course_id);
            return (
              <div key={s.id} className="border rounded-lg p-3 text-sm">
                <p dir="auto" className="font-bold">
                  {course?.code} — {course?.name}
                </p>
                <p>
                  {DAYS.find((d) => d[0] === s.day_of_week)?.[1]} · {s.start_time.slice(0, 5)}–
                  {s.end_time.slice(0, 5)} · {KIND_LABEL[s.kind]} · {s.location}
                </p>
                <p>
                  جروب {s.group_number ?? "الكل"} · سيكشن {s.section_number ?? "الكل"} · لاب{" "}
                  {s.lab_number ?? "الكل"}
                </p>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
