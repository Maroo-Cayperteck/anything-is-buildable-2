import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarDays, MessageSquare } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { getAcademicCatalog } from "@/lib/admin.functions";
import {
  getScheduleAdminData,
  saveScheduleSlot,
  deleteScheduleSlot,
  respondScheduleRequest,
} from "@/lib/scheduling.functions";
import { DAYS, KIND_LABEL } from "@/lib/portal-data";
import curriculum from "@/lib/curriculum-data.json";
export function ScheduleRequests() {
  const q = useQuery({
    queryKey: ["schedule-admin"],
    queryFn: () => getScheduleAdminData(),
    refetchInterval: 60000,
  });
  return (
    <Card
      title={`طلبات تعديل الجداول (${q.data?.requests.filter((r) => r.status === "pending").length ?? 0})`}
      icon={MessageSquare}
    >
      <div className="space-y-4">
        {q.isError && <p>تعذر تحميل الطلبات</p>}
        {q.data?.requests.length === 0 && (
          <p className="text-muted-foreground">لا توجد طلبات بعد.</p>
        )}
        {q.data?.requests.map((r) => (
          <article key={r.id} className="border rounded-lg p-3 space-y-2">
            <Link
              to="/admin/students/$userId"
              params={{ userId: r.student_user_id }}
              className="font-bold text-primary"
            >
              {r.student_profiles?.full_name_ar} — {r.student_profiles?.student_code}
            </Link>
            <p>{r.message}</p>
            {r.status === "pending" ? (
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  try {
                    await respondScheduleRequest({
                      data: {
                        id: r.id,
                        status: String(f.get("status")) as "resolved" | "rejected",
                        reply: String(f.get("reply")),
                      },
                    });
                    await q.refetch();
                    toast.success("تم إرسال الرد");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
                  }
                }}
              >
                <p className="text-xs text-muted-foreground">
                  عدّل خطة الطالب أولًا إن وافقت، ثم اكتب الرد. الرد وحده لا يغيّر الجدول.
                </p>
                <textarea
                  aria-label="رد المسؤول"
                  name="reply"
                  className="w-full border rounded p-2"
                  required
                  minLength={3}
                />
                <select aria-label="حالة طلب الجدول" name="status" className="border p-2 rounded">
                  <option value="resolved">تمت المعالجة</option>
                  <option value="rejected">لم يُقبل الطلب</option>
                </select>
                <Button variant="brand" size="sm">
                  حفظ الرد
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground">{r.admin_reply}</p>
            )}
          </article>
        ))}
      </div>
    </Card>
  );
}
export function ScheduleAdmin() {
  const qc = useQueryClient(),
    [off, setOff] = useState(""),
    [edit, setEdit] = useState("");
  const q = useQuery({ queryKey: ["schedule-admin"], queryFn: () => getScheduleAdminData() });
  const cat = useQuery({
    queryKey: ["admin-academic-catalog"],
    queryFn: () => getAcademicCatalog(),
  });
  const c = cat.data;
  if (!c) return null;
  const row = q.data?.slots.find((s) => s.id === edit);
  const current = off || c.offerings[0]?.id || "";
  return (
    <Card title="جدول الحضور الأساسي — جروب / سيكشن / لاب" icon={CalendarDays}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          الموعد هنا يطبّق على الطلاب المسجلين في المادة والمجموعة المطابقة. اترك رقم التوزيع فارغًا
          ليشمل الجميع. للمواعيد الخاصة بطالب استخدم ملفه.
        </p>
        <select
          aria-label="مقرر الجدول الأساسي"
          className="w-full border rounded-lg p-2"
          value={current}
          onChange={(e) => {
            setOff(e.target.value);
            setEdit("");
          }}
        >
          {c.offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {c.courses.find((x) => x.id === o.course_id)?.code} —{" "}
              {c.courses.find((x) => x.id === o.course_id)?.name} —{" "}
              {c.levels.find((x) => x.id === o.level_id)?.name_ar} —{" "}
              {c.semesters.find((x) => x.id === o.semester_id)?.name_ar}
            </option>
          ))}
        </select>
        <form
          key={edit || current}
          className="space-y-3 border rounded-lg p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
            try {
              await saveScheduleSlot({
                data: {
                  id: edit || undefined,
                  offering_id: current,
                  day_of_week: String(f.get("day")) as "Saturday",
                  start_time: String(f.get("start")),
                  end_time: String(f.get("end")),
                  location: String(f.get("room")),
                  instructor: String(f.get("staff")) || null,
                  kind: String(f.get("kind")) as "lecture" | "section" | "lab",
                  group_number: num("group"),
                  section_number: num("section"),
                  lab_number: num("lab"),
                },
              });
              setEdit("");
              await qc.invalidateQueries({ queryKey: ["schedule-admin"] });
              toast.success("حُفظ الموعد الأساسي");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
            }
          }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label>
              اليوم
              <select
                aria-label="يوم الموعد الأساسي"
                name="day"
                defaultValue={row?.day_of_week ?? "Saturday"}
                className="w-full border p-2 rounded"
              >
                {DAYS.map(([v, n]) => (
                  <option value={v} key={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              النوع
              <select
                aria-label="نوع الموعد الأساسي"
                name="kind"
                defaultValue={row?.kind ?? "lecture"}
                className="w-full border p-2 rounded"
              >
                {Object.entries(KIND_LABEL).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              من
              <input
                aria-label="بداية الموعد الأساسي"
                className="w-full border p-2 rounded"
                name="start"
                type="time"
                defaultValue={row?.start_time.slice(0, 5) ?? "08:00"}
                required
              />
            </label>
            <label>
              إلى
              <input
                aria-label="نهاية الموعد الأساسي"
                className="w-full border p-2 rounded"
                name="end"
                type="time"
                defaultValue={row?.end_time.slice(0, 5) ?? "10:00"}
                required
              />
            </label>
            {[
              ["group", "الجروب", row?.group_number],
              ["section", "السيكشن", row?.section_number],
              ["lab", "اللاب", row?.lab_number],
            ].map(([k, n, v]) => (
              <label key={String(k)}>
                {n}
                <input
                  aria-label={"رقم " + n + " الأساسي"}
                  className="w-full border p-2 rounded"
                  type="number"
                  min={1}
                  max={30}
                  name={String(k)}
                  defaultValue={v ?? ""}
                  placeholder="الجميع"
                />
              </label>
            ))}
            <label>
              القاعة
              <input
                aria-label="قاعة الموعد الأساسي"
                className="w-full border p-2 rounded"
                name="room"
                defaultValue={row?.location ?? ""}
                required
              />
            </label>
          </div>
          <label className="block">
            المحاضر
            <input
              aria-label="محاضر الموعد الأساسي"
              className="w-full border p-2 rounded"
              name="staff"
              defaultValue={row?.instructor ?? ""}
            />
          </label>
          <Button variant="brand">{edit ? "حفظ تعديل الموعد" : "إضافة موعد"}</Button>
          {edit && (
            <Button type="button" variant="ghost" onClick={() => setEdit("")}>
              إلغاء
            </Button>
          )}
        </form>
        {(q.data?.slots ?? [])
          .filter((x) => x.offering_id === current)
          .map((x) => (
            <div key={x.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 text-sm">
              <span>
                {DAYS.find((d) => d[0] === x.day_of_week)?.[1]} {x.start_time.slice(0, 5)}–
                {x.end_time.slice(0, 5)} · {KIND_LABEL[x.kind]} · {x.location}
                <small className="block">
                  G{x.group_number ?? "الكل"} / S{x.section_number ?? "الكل"} / L
                  {x.lab_number ?? "الكل"}
                </small>
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEdit(x.id)}>
                  تعديل
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!window.confirm("حذف هذا الموعد الأساسي لكل الطلاب المرتبطين به؟")) return;
                    try {
                      await deleteScheduleSlot({ data: { id: x.id } });
                      await qc.invalidateQueries({ queryKey: ["schedule-admin"] });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "تعذر الحذف");
                    }
                  }}
                >
                  حذف
                </Button>
              </div>
            </div>
          ))}
        <details>
          <summary className="text-primary cursor-pointer">
            ملاحظات اللائحة والمواعيد غير المكتملة
          </summary>
          <ul className="list-disc pr-5 text-sm space-y-2 mt-2">
            {curriculum.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      </div>
    </Card>
  );
}
