import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { getAcademicCatalog, getAdminStudentDetail } from "@/lib/admin.functions";
import {
  setCourseDistribution,
  applyStudentPlan,
  adminResetStudentPassword,
  getScheduleAdminData,
  saveScheduleOverride,
} from "@/lib/scheduling.functions";
import { arabicGroupSuggestion, matchesChoice, overlappingSlots } from "@/lib/schedule-utils";
import curriculum from "@/lib/curriculum-data.json";
import { DAYS } from "@/lib/portal-data";
export function SmartPlan({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const catalog = useQuery({
    queryKey: ["admin-academic-catalog"],
    queryFn: () => getAcademicCatalog(),
  });
  const detail = useQuery({
    queryKey: ["admin-student-detail", userId],
    queryFn: () => getAdminStudentDetail({ data: { userId } }),
  });
  const sch = useQuery({ queryKey: ["schedule-admin"], queryFn: () => getScheduleAdminData() });
  const [level, setLevel] = useState(""),
    [sem, setSem] = useState(""),
    [g, setG] = useState(1),
    [s, setS] = useState(1),
    [l, setL] = useState(1),
    [selected, setSelected] = useState<string[] | null>(null),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  useEffect(() => {
    const active = detail.data?.enrollments.find((e) => e.status === "enrolled" && e.group_number);
    if (active) {
      setG(active.group_number ?? 1);
      setS(active.section_number ?? 1);
      setL(active.lab_number ?? 1);
    }
  }, [detail.data]);
  if (!catalog.data || !detail.data) return null;
  const c = catalog.data,
    p = detail.data.profile;
  if (!p) return null;
  const levelId = level || p.level_id || c.levels[0]?.id || "",
    semesterId = sem || c.semesters.find((x) => x.is_current)?.id || "";
  const lev = c.levels.find((x) => x.id === levelId),
    semester = c.semesters.find((x) => x.id === semesterId),
    term = semester?.season === "SPRING" ? 2 : 1;
  const defaults = curriculum.courses
    .filter((x) => !x.pool && x.level === lev?.level_number && x.term === term)
    .map((x) => x.code);
  if (lev?.level_number === 1 && term === 1) defaults.push("GEN254");
  const existingIds = detail.data.enrollments
    .filter((e) => e.status === "enrolled")
    .map((e) => c.offerings.find((o) => o.id === e.offering_id))
    .filter((o) => o?.semester_id === semesterId && o.level_id === levelId)
    .map((o) => o!.course_id);
  const ids =
    selected ??
    (existingIds.length
      ? existingIds
      : c.courses.filter((x) => defaults.includes(x.code)).map((x) => x.id));
  const offerings = c.offerings.filter(
    (o) => o.semester_id === semesterId && o.level_id === levelId && ids.includes(o.course_id),
  );
  const slots = (sch.data?.slots ?? []).filter(
    (x) =>
      offerings.some((o) => o.id === x.offering_id) &&
      matchesChoice(x, { group_number: g, section_number: s, lab_number: l }),
  );
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const conflicts = overlappingSlots(
    slots.map((x) => ({
      id: x.id,
      day: x.day_of_week,
      startMinutes: mins(x.start_time),
      endMinutes: mins(x.end_time),
    })),
  );
  const missing = ids.filter(
    (id) => !slots.some((x) => offerings.some((o) => o.id === x.offering_id && o.course_id === id)),
  );
  return (
    <Card title="تجهيز المواد والجدول تلقائيًا" icon={CalendarDays}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          اختر المستوى والترم؛ تُحدد المواد الإلزامية حسب اللائحة. راجع الاختيارية والمتطلبات
          السابقة ثم اعتمد. التطبيق يستبدل تسجيلات هذا الفصل فقط ويحفظ تاريخ الإسقاط.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            المستوى
            <select
              aria-label="مستوى الخطة"
              className="w-full rounded-lg border p-2"
              value={levelId}
              onChange={(e) => {
                setLevel(e.target.value);
                setSelected(null);
              }}
            >
              {c.levels.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label>
            الفصل الدراسي
            <select
              aria-label="فصل الخطة"
              className="w-full rounded-lg border p-2"
              value={semesterId}
              onChange={(e) => {
                setSem(e.target.value);
                setSelected(null);
              }}
            >
              {c.semesters
                .filter((x) => !x.is_closed)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {c.years.find((y) => y.id === x.academic_year_id)?.name} — {x.name_ar}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["الجروب", g, setG],
            ["السيكشن", s, setS],
            ["اللاب", l, setL],
          ].map(([label, value, set]) => (
            <label key={String(label)}>
              {String(label)}
              <input
                aria-label={String(label)}
                className="w-full rounded-lg border p-2"
                type="number"
                min={1}
                max={30}
                value={Number(value)}
                onChange={(e) => (set as (n: number) => void)(Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const a = arabicGroupSuggestion(
              p.full_name_ar,
              lev?.level_number === 0 ? 3 : 2,
              lev?.level_number === 0 ? 7 : 3,
            );
            if (a) {
              setG(a.group);
              setS(a.section);
              setL(a.lab);
              toast.info("اقتراح أبجدي تقريبي؛ راجع التوزيع الرسمي والتعارضات قبل الاعتماد");
            }
          }}
        >
          اقتراح توزيع أبجدي عربي
        </Button>
        <input
          aria-label="بحث المواد"
          placeholder="بحث في كل مواد اللائحة لإضافة مادة أو إعادة دراستها"
          className="w-full rounded-lg border p-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
          {c.courses
            .filter(
              (x) =>
                x.is_active && (x.name + " " + x.code).toLowerCase().includes(search.toLowerCase()),
            )
            .sort((a, b) => Number(ids.includes(b.id)) - Number(ids.includes(a.id)))
            .map((x) => {
              const rule = curriculum.courses.find((r) => r.code === x.code);
              return (
                <label key={x.id} className="flex items-start gap-3 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={ids.includes(x.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? [...ids, x.id] : ids.filter((id) => id !== x.id),
                      )
                    }
                  />
                  <span dir="auto">
                    {x.code} — {x.name} ({x.credit_hours} س)
                    <small className="block text-muted-foreground">
                      {rule?.pool ? "اختياري — " : ""}المتطلبات:{" "}
                      {rule?.prerequisites ?? "غير محددة"}
                    </small>
                  </span>
                </label>
              );
            })}
        </div>
        <p className="text-sm">
          {ids.length} مواد ·{" "}
          {c.courses.filter((x) => ids.includes(x.id)).reduce((a, x) => a + x.credit_hours, 0)} ساعة
          · {slots.length} مواعيد
        </p>
        <p className="text-xs text-muted-foreground">
          بعض الفصول تحتاج مقررات اختيارية إضافية للوصول إلى 18 ساعة. النجاح في المتطلبات السابقة
          يراجعه المسؤول؛ لا تُحذف درجاتك أو تُفترض نتيجة غير موجودة.
        </p>
        {missing.length > 0 && (
          <p role="status" className="rounded-lg bg-warning-soft p-3 text-sm">
            {missing.length} مواد بدون مواعيد منشورة لهذا الاختيار؛ ستُسجّل وتظهر بلا موعد حتى يضيف
            المسؤول مواعيدها.
          </p>
        )}
        {conflicts.length > 0 && (
          <p role="alert" className="text-destructive">
            يوجد {conflicts.length} تعارض مواعيد؛ عدّل التوزيع أو المواد قبل الاعتماد.
          </p>
        )}
        <details>
          <summary className="cursor-pointer text-primary">معاينة الجدول والتعديل الفردي</summary>
          <div className="space-y-3 mt-3">
            {slots.map((x) => {
              const offer = offerings.find((o) => o.id === x.offering_id),
                course = c.courses.find((k) => k.id === offer?.course_id),
                override = sch.data?.overrides.find(
                  (o) => o.student_user_id === userId && o.slot_id === x.id && o.scope === "admin",
                );
              return (
                <form
                  key={x.id + String(override?.updated_at)}
                  className="border rounded-lg p-3 space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    try {
                      await saveScheduleOverride({
                        data: {
                          studentId: userId,
                          slotId: x.id,
                          reset: false,
                          day_of_week: String(f.get("day")) as typeof x.day_of_week,
                          start_time: String(f.get("start")),
                          end_time: String(f.get("end")),
                          location: String(f.get("room")),
                        },
                      });
                      await qc.invalidateQueries({ queryKey: ["schedule-admin"] });
                      toast.success("حُفظ للطالب وحده");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
                    }
                  }}
                >
                  <p dir="auto">
                    {course?.name} — {x.kind}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      aria-label="يوم التعديل الفردي"
                      name="day"
                      defaultValue={override?.day_of_week ?? x.day_of_week}
                    >
                      {DAYS.map(([v, n]) => (
                        <option key={v} value={v}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="بداية التعديل الفردي"
                      type="time"
                      name="start"
                      defaultValue={(override?.start_time ?? x.start_time).slice(0, 5)}
                    />
                    <input
                      aria-label="نهاية التعديل الفردي"
                      type="time"
                      name="end"
                      defaultValue={(override?.end_time ?? x.end_time).slice(0, 5)}
                    />
                    <input
                      aria-label="قاعة التعديل الفردي"
                      name="room"
                      defaultValue={override?.location ?? x.location}
                    />
                  </div>
                  <Button size="sm" variant="outline">
                    حفظ لهذا الطالب فقط
                  </Button>
                  {override && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await saveScheduleOverride({
                          data: {
                            studentId: userId,
                            slotId: x.id,
                            reset: true,
                            day_of_week: x.day_of_week as "Saturday",
                            start_time: x.start_time,
                            end_time: x.end_time,
                            location: x.location,
                          },
                        });
                        await qc.invalidateQueries({ queryKey: ["schedule-admin"] });
                      }}
                    >
                      إلغاء التعديل الفردي
                    </Button>
                  )}
                </form>
              );
            })}
          </div>
        </details>
        <Button
          variant="brand"
          disabled={busy || ids.length === 0 || conflicts.length > 0}
          onClick={async () => {
            setBusy(true);
            try {
              await applyStudentPlan({
                data: {
                  studentId: userId,
                  levelId,
                  semesterId,
                  courseIds: ids,
                  group: g,
                  section: s,
                  lab: l,
                },
              });
              await qc.invalidateQueries();
              toast.success("تم اعتماد المواد والجدول");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "تعذر اعتماد الخطة");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "جارٍ الاعتماد…" : "اعتماد مواد وجدول هذا الفصل"}
        </Button>
        <details>
          <summary className="text-primary cursor-pointer">توزيع مختلف لكل مادة مسجلة</summary>
          <div className="space-y-3 mt-3">
            {detail.data.enrollments
              .filter((e) => e.status === "enrolled")
              .map((e) => {
                const offer = c.offerings.find((o) => o.id === e.offering_id),
                  course = c.courses.find((x) => x.id === offer?.course_id);
                return (
                  <form
                    key={e.id + String(e.updated_at)}
                    className="border rounded-lg p-3 space-y-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const f = new FormData(event.currentTarget);
                      try {
                        await setCourseDistribution({
                          data: {
                            enrollmentId: e.id,
                            group: Number(f.get("g")),
                            section: Number(f.get("s")),
                            lab: Number(f.get("l")),
                          },
                        });
                        await qc.invalidateQueries();
                        toast.success("تم تعديل توزيع المادة لهذا الطالب");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر تعديل التوزيع");
                      }
                    }}
                  >
                    <p dir="auto">
                      {course?.code} — {course?.name}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["g", "الجروب", e.group_number],
                        ["s", "السيكشن", e.section_number],
                        ["l", "اللاب", e.lab_number],
                      ].map(([key, label, value]) => (
                        <label key={String(key)}>
                          {label}
                          <input
                            aria-label={String(label) + " للمادة"}
                            name={String(key)}
                            type="number"
                            min={1}
                            max={30}
                            required
                            className="w-full border p-2 rounded"
                            defaultValue={Number(value ?? 1)}
                          />
                        </label>
                      ))}
                    </div>
                    <Button size="sm" variant="outline">
                      حفظ توزيع المادة
                    </Button>
                  </form>
                );
              })}
          </div>
        </details>
        <details>
          <summary className="cursor-pointer text-primary">إعادة تعيين كلمة مرور الطالب</summary>
          <form
            className="flex flex-wrap gap-2 mt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              try {
                await adminResetStudentPassword({
                  data: { studentId: userId, password: String(f.get("newPassword")) },
                });
                form.reset();
                toast.success("تم تغيير كلمة المرور");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر التغيير");
              }
            }}
          >
            <input
              aria-label="كلمة مرور جديدة للطالب"
              className="border rounded p-2"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Button variant="outline">تعيين بعد التحقق من الهوية</Button>
          </form>
        </details>
      </div>
    </Card>
  );
}
