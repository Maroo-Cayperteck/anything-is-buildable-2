import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAcademicCatalog } from "@/lib/admin.functions";
import {
  getAdminPlanning,
  importPlanningRoster,
  applyRosterPlan,
  saveScheduleException,
  undoScheduleChange,
} from "@/lib/planning.functions";
import { parseRoster, readPlanItems, cairoClock } from "@/lib/planning-utils";
import { matchesChoice, overlappingSlots } from "@/lib/schedule-utils";
import { DAYS } from "@/lib/portal-data";
export function AdminPlanning({ academic = false }: { academic?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-planning"], queryFn: () => getAdminPlanning() });
  const cat = useQuery({
    queryKey: ["admin-academic-catalog"],
    queryFn: () => getAcademicCatalog(),
  });
  const [text, setText] = useState(""),
    [sem, setSem] = useState(""),
    [chosen, setChosen] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("needs"),
    [result, setResult] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false);
  if (q.isError || cat.isError)
    return (
      <p role="alert">
        تعذر تحميل مركز المتابعة{" "}
        <Button
          onClick={() => {
            q.refetch();
            cat.refetch();
          }}
        >
          إعادة المحاولة
        </Button>
      </p>
    );
  if (!q.data || !cat.data) return <p>جارٍ تجهيز مركز المتابعة…</p>;
  const data = q.data,
    c = cat.data,
    semesterId = sem || c.semesters.find((s) => s.is_current)?.id || "";
  let parsed: ReturnType<typeof parseRoster> = [],
    parseError = "";
  if (text) {
    try {
      parsed = parseRoster(text);
    } catch (e) {
      parseError = e instanceof Error ? e.message : "ملف غير صحيح";
    }
  }
  const refresh = () => qc.invalidateQueries();
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التنفيذ");
    } finally {
      setBusy(false);
    }
  };
  const tasks = data.profiles.map((p) => {
    const plan = data.plans.find(
      (x) => x.student_user_id === p.user_id && x.semester_id === semesterId,
    );
    const items = plan
      ? readPlanItems(plan.items)
      : data.enrollments
          .filter(
            (e) =>
              e.student_user_id === p.user_id &&
              c.offerings.some((o) => o.id === e.offering_id && o.semester_id === semesterId),
          )
          .map((e) => ({ offeringId: e.offering_id, ...e }));
    const slots = data.slots.filter((s) =>
      items.some((i) => i.offeringId === s.offering_id && matchesChoice(s, i)),
    );
    const missing =
      items.length === 0 ||
      items.some(
        (i) =>
          !i.group_number ||
          !i.section_number ||
          !i.lab_number ||
          !slots.some((s) => s.offering_id === i.offeringId),
      );
    const conflicts = overlappingSlots(
      slots.map((s) => ({
        id: s.id,
        day: s.day_of_week,
        startMinutes: Number(s.start_time.slice(0, 2)) * 60 + Number(s.start_time.slice(3, 5)),
        endMinutes: Number(s.end_time.slice(0, 2)) * 60 + Number(s.end_time.slice(3, 5)),
      })),
    ).length;
    return {
      ...p,
      missing,
      conflicts,
      pending: p.cgpa === null || p.earned_hours === null || p.academic_status === "في الانتظار",
    };
  });
  const slotTitle = (id: string) => {
    const slot = data.slots.find((s) => s.id === id);
    const o = c.offerings.find((o) => o.id === slot?.offering_id);
    const course = c.courses.find((x) => x.id === o?.course_id);
    return slot
      ? `${course?.code} — ${course?.name} · ${DAYS.find((d) => d[0] === slot.day_of_week)?.[1]} ${slot.start_time.slice(0, 5)} · ج${slot.group_number ?? "الكل"}/س${slot.section_number ?? "الكل"}/ل${slot.lab_number ?? "الكل"}`
      : "موعد محذوف";
  };
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="font-bold text-xl">
        {academic ? "تغييرات المحاضرات والتراجع" : "مركز المتابعة وتجهيز الطلاب بالجملة"}
      </h2>
      {!academic && (
        <>
          <p className="text-sm text-muted-foreground">
            التسجيل مفتوح والدخول فوري. هذه مراجعة البيانات والخطط فقط؛ لا تمنع الطالب من استخدام
            الموقع. مؤشرات التعارض هنا تخص التوزيع الأساسي، أما تعديلات المواعيد الشخصية فتظهر
            للطالب.
          </p>
          <label className="block">
            الفصل
            <select
              aria-label="فصل المتابعة والاستيراد"
              className="w-full border rounded-lg p-2"
              value={semesterId}
              onChange={(e) => {
                setSem(e.target.value);
                setChosen([]);
                setConfirmed(false);
              }}
            >
              {c.semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {c.years.find((y) => y.id === s.academic_year_id)?.name} — {s.name_ar}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              ["needs", "تحتاج مراجعة"],
              ["pending", "بيانات رسمية ناقصة"],
              ["schedule", "توزيع أو مواعيد ناقصة"],
              ["conflict", "تعارضات"],
              ["all", "كل الطلاب"],
            ].map(([v, n]) => (
              <Button
                key={v}
                size="sm"
                variant={filter === v ? "brand" : "outline"}
                onClick={() => setFilter(v!)}
              >
                {n}
              </Button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y">
            {tasks
              .filter(
                (t) =>
                  filter === "all" ||
                  (filter === "pending"
                    ? t.pending
                    : filter === "schedule"
                      ? t.missing
                      : filter === "conflict"
                        ? t.conflicts > 0
                        : t.pending || t.missing || t.conflicts > 0),
              )
              .map((t) => (
                <div key={t.user_id} className="flex gap-3 py-3">
                  <input
                    aria-label={`تحديد ${t.student_code}`}
                    type="checkbox"
                    checked={chosen.includes(t.user_id)}
                    onChange={(e) => {
                      setChosen((xs) =>
                        e.target.checked ? [...xs, t.user_id] : xs.filter((x) => x !== t.user_id),
                      );
                      setConfirmed(false);
                    }}
                  />
                  <div>
                    <Link
                      className="font-bold text-primary"
                      to="/admin/students/$userId"
                      params={{ userId: t.user_id }}
                    >
                      {t.full_name_ar} — {t.student_code}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[
                        t.pending ? "بيانات رسمية في الانتظار" : "",
                        t.missing ? "جدول غير مكتمل" : "",
                        t.conflicts ? `${t.conflicts} تعارضات` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "لا توجد ملاحظات"}
                    </p>
                  </div>
                </div>
              ))}
          </div>
          <details className="border rounded-lg p-3">
            <summary className="font-bold cursor-pointer">استيراد كشف توزيع من Excel / CSV</summary>
            <p className="text-sm my-3">
              صدّر Excel بصيغة CSV UTF-8 أو انسخ الأعمدة والصقها. العناوين:
              student_code,level,group,section,lab. لا يتضمن الكشف درجات أو ملفات شخصية، ولا يغير
              خطط الطلاب الحاليين تلقائيًا.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setText("student_code,level,group,section,lab\n925250050,1,1,1,1")}
            >
              عرض مثال للتنسيق
            </Button>
            <label className="block mt-3">
              ملف CSV
              <input
                aria-label="ملف كشف التوزيع"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 300000) {
                    toast.error("الملف أكبر من 300 كيلوبايت");
                    return;
                  }
                  setText(await file.text());
                }}
              />
            </label>
            <textarea
              aria-label="بيانات كشف التوزيع"
              dir="ltr"
              className="w-full border rounded-lg p-3 h-32 my-3 font-mono text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {parseError && (
              <p role="alert" className="text-destructive">
                {parseError}
              </p>
            )}
            {!!parsed.length && (
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>الرقم</th>
                      <th>المستوى</th>
                      <th>ج/س/ل</th>
                      <th>المعاينة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r) => (
                      <tr key={r.row}>
                        <td>{r.student_code}</td>
                        <td>{r.level}</td>
                        <td>
                          {r.group_number ?? "؟"}/{r.section_number ?? "؟"}/{r.lab_number ?? "؟"}
                        </td>
                        <td className={r.errors.length ? "text-destructive" : ""}>
                          {r.errors.join("، ") || "صالح"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button
              className="mt-3"
              variant="brand"
              disabled={
                busy || !parsed.length || !!parseError || parsed.some((r) => r.errors.length > 0)
              }
              onClick={() =>
                run(
                  () => importPlanningRoster({ data: { text, semesterId } }),
                  "تم حفظ كشف التوزيع",
                )
              }
            >
              حفظ {parsed.length} صف بعد المعاينة
            </Button>
          </details>
          <details className="border rounded-lg p-3">
            <summary className="font-bold cursor-pointer">
              تطبيق الكشف على الطلاب المحددين ({chosen.length})
            </summary>
            <p className="text-sm my-3">
              سيتم استبدال اختيار المواد والمجموعات لهذا الفصل للطلاب المحددين بخطة المستوى وتوزيع
              الكشف. المواعيد الشخصية والدرجات لا تتغير. الطالب يستطيع تعديل نسخته لاحقًا.
            </p>
            <label className="flex gap-2 text-sm mb-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              راجعت الطلاب والفصل وأريد استبدال خطتهم الشخصية بتوزيع الكشف
            </label>
            <Button
              disabled={busy || !confirmed || !chosen.length}
              variant="brand"
              onClick={() =>
                run(async () => {
                  const rows = await applyRosterPlan({ data: { studentIds: chosen, semesterId } });
                  setResult(
                    rows.map(
                      (r) => `${tasks.find((t) => t.user_id === r.id)?.student_code}: ${r.message}`,
                    ),
                  );
                  setConfirmed(false);
                }, "انتهت معالجة الكشف؛ راجع نتيجة كل طالب")
              }
            >
              تطبيق على المحددين
            </Button>
            {result.map((s, i) => (
              <p className="text-sm mt-2" key={i}>
                {s}
              </p>
            ))}
          </details>
        </>
      )}
      {academic && (
        <>
          <p className="text-sm text-muted-foreground">
            إلغاء يوم واحد أو تعويضه لا يغير تكرار الجدول الأسبوعي. يظهر التغيير في يوم الطالب
            والتذكيرات.
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(
                () =>
                  saveScheduleException({
                    data: {
                      slotId: String(f.get("slot")),
                      occurrenceDate: String(f.get("date")),
                      cancelled: f.get("kind") === "cancel",
                      replacementDate: String(f.get("replacement")) || undefined,
                      start: String(f.get("start")) || undefined,
                      end: String(f.get("end")) || undefined,
                      room: String(f.get("room")) || undefined,
                      note: String(f.get("note")),
                    },
                  }),
                "حُفظ تغيير المحاضرة",
              );
            }}
          >
            <label className="block">
              المحاضرة الأصلية
              <select
                name="slot"
                aria-label="محاضرة التغيير المؤقت"
                className="w-full min-w-0 border rounded-lg p-2"
                required
              >
                {data.slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {slotTitle(s.id)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                تاريخ المحاضرة الأصلية
                <input
                  aria-label="تاريخ المحاضرة الأصلية"
                  name="date"
                  type="date"
                  defaultValue={cairoClock().date}
                  className="w-full border p-2 rounded-lg"
                  required
                />
              </label>
              <label>
                نوع التغيير
                <select
                  name="kind"
                  aria-label="نوع التغيير المؤقت"
                  className="w-full border p-2 rounded-lg"
                >
                  <option value="cancel">إلغاء هذا اليوم فقط</option>
                  <option value="move">نقل إلى موعد تعويضي</option>
                </select>
              </label>
              <label>
                تاريخ التعويض
                <input
                  aria-label="تاريخ التعويض"
                  type="date"
                  name="replacement"
                  className="w-full border p-2 rounded-lg"
                />
              </label>
              <label>
                قاعة التعويض
                <input
                  aria-label="قاعة التعويض"
                  name="room"
                  className="w-full border p-2 rounded-lg"
                />
              </label>
              <label>
                من
                <input
                  aria-label="بداية التعويض"
                  name="start"
                  type="time"
                  className="w-full border p-2 rounded-lg"
                />
              </label>
              <label>
                إلى
                <input
                  aria-label="نهاية التعويض"
                  name="end"
                  type="time"
                  className="w-full border p-2 rounded-lg"
                />
              </label>
            </div>
            <label className="block">
              السبب أو الملاحظة
              <input
                aria-label="سبب تغيير المحاضرة"
                name="note"
                maxLength={500}
                className="w-full border p-2 rounded-lg"
              />
            </label>
            <Button variant="brand" disabled={busy}>
              حفظ التغيير لهذا التاريخ
            </Button>
          </form>
          <details className="border rounded-lg p-3">
            <summary className="font-bold cursor-pointer">
              التغييرات المؤقتة المنشورة ({data.exceptions.length})
            </summary>
            {data.exceptions.map((e) => (
              <div key={e.id} className="border-t py-3 text-sm">
                <p>{slotTitle(e.slot_id)}</p>
                <p>
                  {e.occurrence_date} · {e.cancelled ? "إلغاء" : `تعويض ${e.replacement_date}`} ·{" "}
                  {e.note}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        saveScheduleException({
                          data: {
                            slotId: e.slot_id,
                            occurrenceDate: e.occurrence_date,
                            cancelled: true,
                            note: "",
                            remove: true,
                          },
                        }),
                      "عاد الموعد الأسبوعي المعتاد",
                    )
                  }
                >
                  إلغاء الاستثناء وإعادة الموعد المعتاد
                </Button>
              </div>
            ))}
          </details>
          <details className="border rounded-lg p-3">
            <summary className="font-bold cursor-pointer">
              سجل تعديلات الجدول الأسبوعي والتراجع
            </summary>
            {!data.history.length && <p className="py-3">لا توجد تعديلات بعد.</p>}
            {data.history.map((h) => (
              <div key={h.id} className="border-t py-3 text-sm">
                <p>{slotTitle(h.slot_id)}</p>
                <p>
                  {new Date(h.created_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !!h.undone_at}
                  onClick={() =>
                    run(
                      () => undoScheduleChange({ data: { historyId: h.id } }),
                      "تم التراجع عن التعديل",
                    )
                  }
                >
                  {h.undone_at ? "تم التراجع" : "استعادة الموعد قبل هذا التعديل"}
                </Button>
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
