import { resetMyPlan } from "@/lib/planning.functions";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPlanningCatalog, saveMyPlan, applyRosterPlan } from "@/lib/planning.functions";
import { readPlanItems, suggestedCodes, type PlanItem } from "@/lib/planning-utils";
import { DAYS, KIND_LABEL } from "@/lib/portal-data";
import type { usePortalSnapshot } from "@/lib/use-profile";
type Snapshot = NonNullable<ReturnType<typeof usePortalSnapshot>["data"]>;
type Catalog = Awaited<ReturnType<typeof getPlanningCatalog>>;
const selectClass = "w-full min-w-0 rounded-lg border bg-background p-2";
export function PersonalPlanner({ snap }: { snap: Snapshot }) {
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
      c={q.data}
    />
  );
}
function Planner({ snap, c }: { snap: Snapshot; c: Catalog }) {
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
  const setChoice = (key: "group_number" | "section_number" | "lab_number", value: string) => {
    const next = { ...distribution, [key]: value ? Number(value) : null };
    setDistribution(next);
    setItems((xs) => xs.map((x) => ({ ...x, [key]: next[key] })));
  };
  const refresh = () => qc.invalidateQueries();
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
      <details
        className="rounded-xl border bg-card p-4"
        open={snap.enrollments.length === 0 || !snap.timetable.length}
      >
        <summary className="cursor-pointer font-bold">اختيار موادي والجروب والسيكشن واللاب</summary>
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
            {(
              [
                ["group_number", "الجروب", 20],
                ["section_number", "السيكشن", 30],
                ["lab_number", "اللاب", 30],
              ] as const
            ).map(([key, label, max]) => (
              <label key={key}>
                {label}
                <select
                  aria-label={label + " لكل المواد"}
                  className={selectClass}
                  value={distribution[key] ?? ""}
                  onChange={(e) => setChoice(key, e.target.value)}
                >
                  <option value="">لا أعرف</option>
                  {Array.from({ length: max }, (_, i) => (
                    <option value={i + 1} key={i}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            «لا أعرف» لا يفترض مجموعة. استخدم الجدول الأساسي بالأسفل لمعرفة الخيارات. لا تستخدم
            اقتراحات المواد كدليل نجاح في متطلب سابق.
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
                      {(
                        [
                          ["group_number", "جروب"],
                          ["section_number", "سيكشن"],
                          ["lab_number", "لاب"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            aria-label={`${label} ${course?.code}`}
                            type="number"
                            min={1}
                            max={key === "group_number" ? 20 : 30}
                            className={selectClass}
                            value={item[key] ?? ""}
                            onChange={(e) =>
                              setItems((xs) =>
                                xs.map((x) =>
                                  x.courseId === item.courseId
                                    ? {
                                        ...x,
                                        [key]: e.target.value ? Number(e.target.value) : null,
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
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
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
                } finally {
                  setBusy(false);
                }
              }}
            >
              حفظ موادي وتوزيعي
            </Button>
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
          </div>
        </div>
      </details>
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
