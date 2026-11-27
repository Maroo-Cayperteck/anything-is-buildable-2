import {AdminPlanning} from "@/components/portal/AdminPlanning";
import {ScheduleAdmin} from "@/components/portal/ScheduleAdmin";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, CalendarDays, Layers, Loader2, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminDeleteLecture,
  adminUpsertAcademicYear,
  adminUpsertCourse,
  adminUpsertGroup,
  adminUpsertLecture,
  adminUpsertLevel,
  adminUpsertOffering,
  adminUpsertProgram,
  adminUpsertSemester,
  getAcademicCatalog,
} from "@/lib/admin.functions";
import { DAYS, KIND_LABEL, type SlotKind } from "@/lib/portal-data";
import { formatTimeDisplay } from "@/lib/auth-helpers";

export const Route = createFileRoute("/admin/academic")({
  component: AdminAcademicPage,
});

function AdminAcademicPage() {
  const qc = useQueryClient();
  const catalog = useQuery({
    queryKey: ["admin-academic-catalog"],
    queryFn: () => getAcademicCatalog(),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-academic-catalog"] });

  // Program & Level
  const [pCode, setPCode] = useState("");
  const [pNameAr, setPNameAr] = useState("");
  const [pFaculty, setPFaculty] = useState("");
  const [lProgramId, setLProgramId] = useState("");
  const [lNumber, setLNumber] = useState("1");
  const [lNameAr, setLNameAr] = useState("");

  // Year & Semester
  const [yName, setYName] = useState("");
  const [sYearId, setSYearId] = useState("");
  const [sSeason, setSSeason] = useState<"FALL" | "SPRING" | "SUMMER">("FALL");
  const [sNameAr, setSNameAr] = useState("");
  const [sCurrent, setSCurrent] = useState(true);

  // Course, Offering, Group, Lecture
  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [cHours, setCHours] = useState("3");
  const [oCourseId, setOCourseId] = useState("");
  const [oSemesterId, setOSemesterId] = useState("");
  const [oProgramId, setOProgramId] = useState("");
  const [gOfferingId, setGOfferingId] = useState("");
  const [gName, setGName] = useState("");
  const [gInstructor, setGInstructor] = useState("");
  const [lecGroupId, setLecGroupId] = useState("");
  const [lecDay, setLecDay] = useState<
    "Saturday" | "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday"
  >("Saturday");
  const [lecStart, setLecStart] = useState("08:00");
  const [lecEnd, setLecEnd] = useState("10:00");
  const [lecKind, setLecKind] = useState<SlotKind>("lecture");
  const [lecLocation, setLecLocation] = useState("");
  const [lecInstructor, setLecInstructor] = useState("");

  if (catalog.isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (catalog.isError) {
    return (
      <div className="space-y-4 rounded-xl border bg-card p-8 text-center">
        <p className="text-destructive">تعذر تحميل الكتالوج الأكاديمي من الخادم.</p>
        <Button variant="outline" onClick={() => catalog.refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const programs = catalog.data?.programs ?? [];
  const levels = catalog.data?.levels ?? [];
  const years = catalog.data?.years ?? [];
  const semesters = catalog.data?.semesters ?? [];
  const courses = catalog.data?.courses ?? [];
  const offerings = catalog.data?.offerings ?? [];
  const groups = catalog.data?.groups ?? [];
  const lectures = catalog.data?.lectures ?? [];

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const semesterMap = new Map(semesters.map((s) => [s.id, s]));
  const offeringMap = new Map(offerings.map((o) => [o.id, o]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  return (
    <div className="space-y-6">
      <ScheduleAdmin/>
      <AdminPlanning academic/>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="البرامج والمستويات الأكاديمية" icon={Layers}>
          <form
            className="mb-5 space-y-3 border-b pb-5"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminUpsertProgram({
                  data: { code: pCode, name_ar: pNameAr, faculty: pFaculty },
                });
                setPCode("");
                setPNameAr("");
                setPFaculty("");
                await refresh();
                toast.success("تم حفظ البرنامج");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
              }
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground">إضافة برنامج أكاديمي</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                value={pCode}
                onChange={(e) => setPCode(e.target.value)}
                dir="ltr"
                placeholder="الكود (NCSE)"
                required
              />
              <Input
                value={pNameAr}
                onChange={(e) => setPNameAr(e.target.value)}
                placeholder="اسم البرنامج"
                required
              />
              <Input
                value={pFaculty}
                onChange={(e) => setPFaculty(e.target.value)}
                placeholder="الكلية"
              />
            </div>
            <Button size="sm" variant="brand" type="submit">
              <Plus className="h-4 w-4" /> حفظ البرنامج
            </Button>
          </form>

          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminUpsertLevel({
                  data: { program_id: lProgramId, level_number: Number(lNumber), name_ar: lNameAr },
                });
                setLNameAr("");
                await refresh();
                toast.success("تم حفظ المستوى");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
              }
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground">إضافة مستوى دراسي</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                className="rounded-lg border bg-background px-3 py-2 text-sm"
                value={lProgramId}
                onChange={(e) => setLProgramId(e.target.value)}
                required
              >
                <option value="">اختر البرنامج</option>
                {programs.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name_ar}
                  </option>
                ))}
              </select>
              <Input
                value={lNumber}
                onChange={(e) => setLNumber(e.target.value)}
                type="number"
                min="1"
                max="10"
                dir="ltr"
                placeholder="رقم المستوى"
                required
              />
              <Input
                value={lNameAr}
                onChange={(e) => setLNameAr(e.target.value)}
                placeholder="المستوى الثاني"
                required
              />
            </div>
            <Button size="sm" variant="outline" type="submit">
              <Plus className="h-4 w-4" /> حفظ المستوى
            </Button>
          </form>

          {levels.length > 0 && (
            <div className="mt-4 text-xs text-muted-foreground">
              المستويات المسجلة: {levels.map((l) => l.name_ar).join(" · ")}
            </div>
          )}
        </Card>

        <Card title="الأعوام والفصول الدراسية" icon={CalendarDays}>
          <form
            className="mb-5 space-y-3 border-b pb-5"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminUpsertAcademicYear({ data: { name: yName, is_current: true } });
                setYName("");
                await refresh();
                toast.success("تم حفظ العام الأكاديمي");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
              }
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground">
              إضافة عام أكاديمي (يُعيّن كحالي)
            </div>
            <div className="flex gap-2">
              <Input
                value={yName}
                onChange={(e) => setYName(e.target.value)}
                dir="ltr"
                placeholder="2026 / 2027"
                required
              />
              <Button size="sm" variant="brand" type="submit">
                <Plus className="h-4 w-4" /> حفظ
              </Button>
            </div>
          </form>

          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminUpsertSemester({
                  data: {
                    academic_year_id: sYearId,
                    season: sSeason,
                    name_ar: sNameAr,
                    is_current: sCurrent,
                    is_closed: false,
                  },
                });
                setSNameAr("");
                await refresh();
                toast.success("تم حفظ الفصل الدراسي");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
              }
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground">إضافة فصل دراسي</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                className="rounded-lg border bg-background px-3 py-2 text-sm"
                value={sYearId}
                onChange={(e) => setSYearId(e.target.value)}
                required
              >
                <option value="">العام الأكاديمي</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border bg-background px-3 py-2 text-sm"
                value={sSeason}
                onChange={(e) => setSSeason(e.target.value as "FALL" | "SPRING" | "SUMMER")}
              >
                <option value="FALL">الخريف (FALL)</option>
                <option value="SPRING">الربيع (SPRING)</option>
                <option value="SUMMER">الصيفي (SUMMER)</option>
              </select>
              <Input
                value={sNameAr}
                onChange={(e) => setSNameAr(e.target.value)}
                placeholder="الفصل الأول"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={sCurrent}
                onChange={(e) => setSCurrent(e.target.checked)}
              />
              تعيين كفصل دراسي حالي
            </label>
            <Button size="sm" variant="outline" type="submit">
              <Plus className="h-4 w-4" /> حفظ الفصل الدراسي
            </Button>
          </form>

          {(years.length > 0 || semesters.length > 0) && (
            <div className="mt-5 space-y-2 border-t pt-4 text-xs">
              {years.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-muted-foreground">الأعوام:</span>
                  {years.map((y) => (
                    <button
                      key={y.id}
                      type="button"
                      onClick={async () => {
                        if (y.is_current) return;
                        try {
                          await adminUpsertAcademicYear({
                            data: { id: y.id, name: y.name, is_current: true },
                          });
                          await refresh();
                          toast.success(`تم تعيين ${y.name} كعام حالي`);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "تعذر التحديث");
                        }
                      }}
                      className={`rounded-full px-2.5 py-0.5 font-mono transition ${
                        y.is_current
                          ? "bg-success-soft font-semibold text-success"
                          : "border hover:bg-muted"
                      }`}
                    >
                      {y.name} {y.is_current ? "✓ الحالي" : ""}
                    </button>
                  ))}
                </div>
              )}
              {semesters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-muted-foreground">الفصول:</span>
                  {semesters.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={async () => {
                        if (s.is_current) return;
                        try {
                          await adminUpsertSemester({
                            data: {
                              id: s.id,
                              academic_year_id: s.academic_year_id,
                              season: s.season as "FALL" | "SPRING" | "SUMMER",
                              name_ar: s.name_ar,
                              is_current: true,
                              is_closed: s.is_closed,
                            },
                          });
                          await refresh();
                          toast.success(`تم تعيين ${s.name_ar} كفصل حالي`);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "تعذر التحديث");
                        }
                      }}
                      className={`rounded-full px-2.5 py-0.5 transition ${
                        s.is_current
                          ? "bg-success-soft font-semibold text-success"
                          : "border hover:bg-muted"
                      }`}
                    >
                      {s.name_ar} {s.is_current ? "✓ الحالي" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card title="المقررات وطرح الفصول والمجموعات" icon={BookOpen}>
        <div className="grid gap-6 lg:grid-cols-3">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminUpsertCourse({
                  data: { code: cCode, name: cName, credit_hours: Number(cHours), is_active: true },
                });
                setCCode("");
                setCName("");
                await refresh();
                toast.success("تم حفظ المقرر");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
              }
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground">1. إضافة مقرر دراسي</div>
            <Input
              value={cCode}
              onChange={(e) => setCCode(e.target.value)}
              dir="ltr"
              placeholder="CSE121"
              required
            />
            <Input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              dir="ltr"
              placeholder="Computer Programming"
              required
            />
            <Input
              value={cHours}
              onChange={(e) => setCHours(e.target.value)}
              type="number"
              min="1"
              max="12"
              dir="ltr"
              placeholder="الساعات المعتمدة"
              required
            />
            <Button size="sm" variant="brand" type="submit">
              <Plus className="h-4 w-4" /> إضافة مقرر
            </Button>
          </form>

          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminUpsertOffering({
                  data: {
                    course_id: oCourseId,
                    semester_id: oSemesterId,
                    program_id: oProgramId || null,
                    is_active: true,
                  },
                });
                await refresh();
                toast.success("تم طرح المقرر في الفصل");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر الطرح");
              }
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground">2. طرح مقرر في فصل</div>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={oCourseId}
              onChange={(e) => setOCourseId(e.target.value)}
              required
            >
              <option value="">اختر المقرر</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={oSemesterId}
              onChange={(e) => setOSemesterId(e.target.value)}
              required
            >
              <option value="">اختر الفصل الدراسي</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_ar}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={oProgramId}
              onChange={(e) => setOProgramId(e.target.value)}
            >
              <option value="">كل البرامج (اختياري)</option>
              {programs.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name_ar}
                </option>
              ))}
            </select>
            <Button size="sm" variant="brand" type="submit">
              <Plus className="h-4 w-4" /> حفظ الطرح
            </Button>
          </form>

          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminUpsertGroup({
                  data: { offering_id: gOfferingId, name: gName, instructor: gInstructor },
                });
                setGName("");
                setGInstructor("");
                await refresh();
                toast.success("تم إضافة المجموعة");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
              }
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground">
              3. إضافة مجموعة / سكشن لطرح مقرر
            </div>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={gOfferingId}
              onChange={(e) => setGOfferingId(e.target.value)}
              required
            >
              <option value="">اختر طرح المقرر</option>
              {offerings.map((o) => {
                const crs = courseMap.get(o.course_id);
                const sem = semesterMap.get(o.semester_id);
                return (
                  <option key={o.id} value={o.id}>
                    {crs ? `${crs.code} — ${crs.name}` : o.id} ({sem?.name_ar ?? ""})
                  </option>
                );
              })}
            </select>
            <Input
              value={gName}
              onChange={(e) => setGName(e.target.value)}
              dir="ltr"
              placeholder="Group 1 - Section 1"
              required
            />
            <Input
              value={gInstructor}
              onChange={(e) => setGInstructor(e.target.value)}
              dir="ltr"
              placeholder="المحاضر"
            />
            <Button size="sm" variant="brand" type="submit">
              <Plus className="h-4 w-4" /> إضافة المجموعة
            </Button>
          </form>
        </div>
      </Card>

      <Card title="جدولة المحاضرات والسكاشن والمعامل" icon={CalendarDays}>
        <form
          className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await adminUpsertLecture({
                data: {
                  group_id: lecGroupId,
                  day_of_week: lecDay,
                  start_time: lecStart,
                  end_time: lecEnd,
                  kind: lecKind,
                  location: lecLocation,
                  instructor: lecInstructor,
                },
              });
              setLecLocation("");
              setLecInstructor("");
              await refresh();
              toast.success("تم إضافة الحصة للجدول");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
            }
          }}
        >
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            value={lecGroupId}
            onChange={(e) => setLecGroupId(e.target.value)}
            required
          >
            <option value="">اختر المجموعة</option>
            {groups.map((g) => {
              const off = offeringMap.get(g.offering_id);
              const crs = off ? courseMap.get(off.course_id) : undefined;
              return (
                <option key={g.id} value={g.id}>
                  {crs ? `${crs.code} · ` : ""}
                  {g.name}
                </option>
              );
            })}
          </select>
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            value={lecDay}
            onChange={(e) => setLecDay(e.target.value as typeof lecDay)}
          >
            {DAYS.map(([en, ar]) => (
              <option key={en} value={en}>
                {ar}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={lecStart}
              onChange={(e) => setLecStart(e.target.value)}
              type="time"
              step="300"
              aria-label="وقت البدء"
              dir="ltr"
              required
            />
            <Input
              value={lecEnd}
              onChange={(e) => setLecEnd(e.target.value)}
              type="time"
              step="300"
              aria-label="وقت الانتهاء"
              dir="ltr"
              required
            />
          </div>
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            value={lecKind}
            onChange={(e) => setLecKind(e.target.value as SlotKind)}
          >
            {(Object.keys(KIND_LABEL) as SlotKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <Input
            value={lecLocation}
            onChange={(e) => setLecLocation(e.target.value)}
            dir="ltr"
            placeholder="القاعة / المعمل (Hall 1)"
            required
          />
          <Input
            value={lecInstructor}
            onChange={(e) => setLecInstructor(e.target.value)}
            dir="ltr"
            placeholder="المحاضر (اختياري)"
          />
          <Button variant="brand" type="submit">
            <Plus className="h-4 w-4" /> إضافة للجدول
          </Button>
        </form>

        {lectures.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">لا توجد حصص مجدولة بعد.</p>
        ) : (
          <div className="divide-y text-sm">
            {lectures.map((lec) => {
              const grp = groupMap.get(lec.group_id);
              const off = grp ? offeringMap.get(grp.offering_id) : undefined;
              const crs = off ? courseMap.get(off.course_id) : undefined;
              return (
                <div
                  key={lec.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <span className="font-medium">{crs ? `${crs.code} — ${crs.name}` : ""}</span>
                    <span className="mx-2 text-xs text-muted-foreground">
                      ({grp?.name}) · {DAYS.find((d) => d[0] === lec.day_of_week)?.[1]} ·{" "}
                      {formatTimeDisplay(lec.start_time, lec.start_hour)}–
                      {formatTimeDisplay(lec.end_time, lec.end_hour)} · {KIND_LABEL[lec.kind]} ·{" "}
                      {lec.location}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      try {
                        await adminDeleteLecture({ data: { id: lec.id } });
                        await refresh();
                        toast.success("تم حذف الحصة");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر حذف الحصة");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
