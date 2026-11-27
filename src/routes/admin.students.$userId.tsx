import {SmartPlan} from "@/components/portal/SmartPlan";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Award,
  BookOpen,
  Eye,
  FileText,
  Loader2,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LazyPdf } from "@/components/portal/LazyPdf";
import {
  adminDeleteSemesterGradeSummary,
  adminDeleteStudentGrade,
  adminEnrollStudent,
  adminRemoveEnrollment,
  adminSetStudentAccountStatus,
  adminUpdateEnrollmentStatus,
  adminUpdateStudentProfile,
  adminUpsertSemesterGradeSummary,
  adminUpsertStudentGrade,
  getAcademicCatalog,
  getAdminStudentDetail,
} from "@/lib/admin.functions";
import {
  deletePrivateStudentDocument,
  togglePrivateStudentDocument,
  uploadPrivateStudentDocument,
} from "@/lib/documents-storage";
import { formatSize, signedUrl } from "@/lib/portal-data";

export const Route = createFileRoute("/admin/students/$userId")({
  component: AdminStudentDetail,
});

function AdminStudentDetail() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["admin-student-detail", userId],
    queryFn: () => getAdminStudentDetail({ data: { userId } }),
  });
  const catalog = useQuery({
    queryKey: ["admin-academic-catalog"],
    queryFn: () => getAcademicCatalog(),
  });

  const p = detail.data?.profile;

  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [yearId, setYearId] = useState("");
  const [academicStatus, setAcademicStatus] = useState("");
  const [cgpa, setCgpa] = useState("");
  const [earnedHours, setEarnedHours] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Enrollment form
  const [offeringId, setOfferingId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  // Private doc form
  const [docTitle, setDocTitle] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [uploadingPrivate, setUploadingPrivate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<{ title: string; url: string } | null>(null);

  // Grade form
  const [gSemesterId, setGSemesterId] = useState("");
  const [gCourseId, setGCourseId] = useState("");
  const [gMarks, setGMarks] = useState("");
  const [gLetter, setGLetter] = useState("");
  const [gPoints, setGPoints] = useState("");
  const [gPublished, setGPublished] = useState(true);
  const [savingGrade, setSavingGrade] = useState(false);

  // Semester summary GPA form
  const [sumSemesterId, setSumSemesterId] = useState("");
  const [sumGpa, setSumGpa] = useState("");
  const [sumPublished, setSumPublished] = useState(true);
  const [savingSummary, setSavingSummary] = useState(false);

  // Suspend confirm
  const [confirmSuspend, setConfirmSuspend] = useState<"suspended" | "active" | null>(null);

  useEffect(() => {
    if (!p) return;
    setFullNameAr(p.full_name_ar);
    setFullNameEn(p.full_name_en ?? "");
    setStudentCode(p.student_code ?? "");
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
    setProgramId(p.program_id ?? "");
    setLevelId(p.level_id ?? "");
    setYearId(p.academic_year_id ?? "");
    setAcademicStatus(p.academic_status ?? "مقيد — منتظم");
    setCgpa(p.cgpa != null ? String(p.cgpa) : "");
    setEarnedHours(p.earned_hours != null ? String(p.earned_hours) : "");
  }, [p]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-student-detail", userId] }),
      qc.invalidateQueries({ queryKey: ["admin-students"] }),
      qc.invalidateQueries({ queryKey: ["student-documents-bundle"] }),
      qc.invalidateQueries({ queryKey: ["admin-overview"] }),
      qc.invalidateQueries({ queryKey: ["signed-doc"] }),
    ]);
    await qc.refetchQueries({ queryKey: ["admin-student-detail", userId] }, { throwOnError: true });
  };

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await adminUpdateStudentProfile({
        data: {
          user_id: userId,
          full_name_ar: fullNameAr,
          full_name_en: fullNameEn || null,
          student_code: studentCode,
          email: email || null,
          phone: phone || null,
          program_id: programId || null,
          level_id: levelId || null,
          academic_year_id: yearId || null,
          academic_status: academicStatus || null,
          cgpa: cgpa.trim() ? Number(cgpa) : null,
          earned_hours: earnedHours.trim() ? Number(earnedHours) : null,
        },
      });
      await refresh();
      toast.success("تم حفظ بيانات الطالب الرسمية");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر حفظ البيانات");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePrivateUpload(file: File) {
    if (!docTitle.trim()) {
      toast.error("يرجى كتابة عنوان الملف الخاص أولًا");
      return;
    }
    setUploadingPrivate(true);
    try {
      await uploadPrivateStudentDocument({
        studentUserId: userId,
        title: docTitle.trim(),
        description: docDesc.trim(),
        file,
      });
      setDocTitle("");
      setDocDesc("");
      await refresh();
      toast.success("تم رفع الملف الخاص بالطالب وحفظه في القاعدة");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل رفع الملف");
    } finally {
      setUploadingPrivate(false);
    }
  }

  if (detail.isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (detail.isError || !p) {
    return (
      <div className="space-y-4 rounded-xl border bg-card p-8 text-center">
        <p className="text-destructive">تعذر تحميل ملف الطالب.</p>
        <Button variant="outline" onClick={() => detail.refetch()}>
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

  const filteredGroups = groups.filter((g) => g.offering_id === offeringId);
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const offeringMap = new Map(offerings.map((o) => [o.id, o]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const semesterMap = new Map(semesters.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <SmartPlan userId={userId}/>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/students">
            <ArrowRight className="h-4 w-4" /> العودة لقائمة الطلاب
          </Link>
        </Button>
        <h2 className="text-lg font-bold">{p.full_name_ar}</h2>
        <span className="rounded-full bg-secondary px-3 py-0.5 font-mono text-xs">
          {p.account_status}
        </span>
        <Button
          size="sm"
          variant={p.account_status === "suspended" ? "brand" : "outline"}
          className="mr-auto"
          onClick={() =>
            setConfirmSuspend(p.account_status === "suspended" ? "active" : "suspended")
          }
        >
          <ShieldAlert className="h-4 w-4" />
          {p.account_status === "suspended" ? "إعادة تفعيل الحساب" : "تعليق الحساب"}
        </Button>
      </div>

      <Card title="البيانات الرسمية والأكاديمية" icon={UserRound}>
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">الاسم بالعربية</label>
            <Input value={fullNameAr} onChange={(e) => setFullNameAr(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">الاسم بالإنجليزية</label>
            <Input value={fullNameEn} onChange={(e) => setFullNameEn(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">الرقم الجامعي</label>
            <Input
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              dir="ltr"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">البريد الإلكتروني</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">الهاتف</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">الحالة الأكاديمية</label>
            <Input value={academicStatus} onChange={(e) => setAcademicStatus(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">البرنامج الأكاديمي</label>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              <option value="">غير محدد</option>
              {programs.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name_ar}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">المستوى الأكاديمي</label>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
            >
              <option value="">غير محدد</option>
              {levels.map((lv) => (
                <option key={lv.id} value={lv.id}>
                  {lv.name_ar}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">العام الأكاديمي</label>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
            >
              <option value="">غير محدد</option>
              {years.map((yr) => (
                <option key={yr.id} value={yr.id}>
                  {yr.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              المعدل التراكمي المعتمد (اختياري)
            </label>
            <Input
              value={cgpa}
              onChange={(e) => setCgpa(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              max="4"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              الساعات المكتسبة (اختياري)
            </label>
            <Input
              value={earnedHours}
              onChange={(e) => setEarnedHours(e.target.value)}
              type="number"
              min="0"
              dir="ltr"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="brand" disabled={savingProfile}>
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}{" "}
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Card>

      <Card title="تسجيل المقررات والمجموعات للطالب" icon={BookOpen}>
        <div className="mb-5 flex flex-wrap gap-3">
          <select
            className="min-w-52 rounded-lg border bg-background px-3 py-2 text-sm"
            value={offeringId}
            onChange={(e) => {
              setOfferingId(e.target.value);
              setGroupId("");
            }}
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
          <select
            className="min-w-44 rounded-lg border bg-background px-3 py-2 text-sm"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">اختر المجموعة</option>
            {filteredGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <Button
            variant="brand"
            disabled={!offeringId || !groupId || enrolling}
            onClick={async () => {
              setEnrolling(true);
              try {
                await adminEnrollStudent({
                  data: { student_user_id: userId, offering_id: offeringId, group_id: groupId },
                });
                await refresh();
                toast.success("تم تسجيل الطالب في المجموعة");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر التسجيل");
              } finally {
                setEnrolling(false);
              }
            }}
          >
            {enrolling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}{" "}
            تسجيل
          </Button>
        </div>

        {(detail.data?.enrollments.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد تسجيلات مقررات لهذا الطالب.</p>
        ) : (
          <div className="divide-y text-sm">
            {detail.data?.enrollments.map((enr) => {
              const off = offeringMap.get(enr.offering_id);
              const crs = off ? courseMap.get(off.course_id) : undefined;
              const grp = groupMap.get(enr.group_id);
              const statusLabel =
                enr.status === "dropped" ? "منسحب" : enr.status === "completed" ? "مكتمل" : "مسجل";
              return (
                <div
                  key={enr.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <span className="font-medium">
                      {crs ? `${crs.code} — ${crs.name}` : enr.offering_id}
                    </span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="font-mono text-xs">{grp?.name ?? enr.group_id}</span>
                    <span className="mx-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {enr.status === "enrolled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await adminUpdateEnrollmentStatus({
                              data: { id: enr.id, status: "dropped" },
                            });
                            await refresh();
                            toast.success("تم تسجيل الانسحاب مع الاحتفاظ بالسجل التاريخي");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "تعذر التحديث");
                          }
                        }}
                      >
                        إسقاط (حفظ بالسجل)
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        try {
                          await adminRemoveEnrollment({ data: { id: enr.id } });
                          await refresh();
                          toast.success("تم حذف التسجيل");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "تعذر إلغاء التسجيل");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="الملفات الخاصة بالطالب" icon={FileText}>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Input
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="عنوان الملف الخاص (مثال: إفادة قيد)"
          />
          <Input
            value={docDesc}
            onChange={(e) => setDocDesc(e.target.value)}
            placeholder="ملاحظة / وصف (اختياري)"
          />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePrivateUpload(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="brand"
              disabled={uploadingPrivate}
              onClick={() => fileRef.current?.click()}
            >
              {uploadingPrivate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}{" "}
              رفع ملف PDF خاص
            </Button>
          </div>
        </div>

        {(detail.data?.privateDocs.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد ملفات خاصة مرفوعة لهذا الطالب.</p>
        ) : (
          <div className="divide-y text-sm">
            {detail.data?.privateDocs.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">{d.title}</div>
                  <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {d.file_name} · {formatSize(d.file_size)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const url = await signedUrl(d.id, undefined, {
                          allowHidden: true,
                          kind: "private",
                        });
                        setPreviewUrl({ title: d.title, url });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر المعاينة");
                      }
                    }}
                  >
                    <Eye className="h-4 w-4" /> معاينة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const nextState = !d.is_available;
                        await togglePrivateStudentDocument(d.id, nextState);
                        await refresh();
                        toast.success(
                          nextState
                            ? "تمت إتاحة الملف الخاص للطالب"
                            : "تم إخفاء الملف الخاص عن الطالب",
                        );
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر تغيير حالة الملف");
                      }
                    }}
                  >
                    {d.is_available ? "إخفاء" : "إتاحة"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      try {
                        const res = await deletePrivateStudentDocument(d.id);
                        await refresh();
                        if (res?.storageCleanupQueued) {
                          toast.warning("تم حذف سجل الملف الخاص وجدولة تنظيف ملف التخزين مؤقتًا");
                        } else {
                          toast.success("تم حذف الملف الخاص");
                        }
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذر حذف الملف الخاص");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="إدارة النتائج المعتمدة للطالب" icon={Award}>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            value={gSemesterId}
            onChange={(e) => setGSemesterId(e.target.value)}
          >
            <option value="">الفصل الدراسي</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm"
            value={gCourseId}
            onChange={(e) => setGCourseId(e.target.value)}
          >
            <option value="">المقرر</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <Input
            value={gMarks}
            onChange={(e) => setGMarks(e.target.value)}
            type="number"
            step="0.5"
            placeholder="الدرجة"
            dir="ltr"
          />
          <Input
            value={gLetter}
            onChange={(e) => setGLetter(e.target.value)}
            placeholder="التقدير (B+)"
            dir="ltr"
          />
          <Input
            value={gPoints}
            onChange={(e) => setGPoints(e.target.value)}
            type="number"
            step="0.1"
            placeholder="النقاط (3.3)"
            dir="ltr"
          />
          <Button
            variant="brand"
            disabled={!gSemesterId || !gCourseId || savingGrade}
            onClick={async () => {
              setSavingGrade(true);
              try {
                await adminUpsertStudentGrade({
                  data: {
                    student_user_id: userId,
                    semester_id: gSemesterId,
                    course_id: gCourseId,
                    marks: gMarks ? Number(gMarks) : null,
                    grade_letter: gLetter || null,
                    grade_points: gPoints ? Number(gPoints) : null,
                    is_published: gPublished,
                  },
                });
                await refresh();
                toast.success("تم حفظ النتيجة");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
              } finally {
                setSavingGrade(false);
              }
            }}
          >
            {savingGrade ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            حفظ النتيجة
          </Button>
        </div>
        <label className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={gPublished}
            onChange={(e) => setGPublished(e.target.checked)}
          />
          نشر النتيجة للطالب فور الحفظ
        </label>

        {(detail.data?.grades.length ?? 0) > 0 && (
          <div className="divide-y text-sm">
            {detail.data?.grades.map((g) => {
              const crs = courseMap.get(g.course_id);
              const sem = semesterMap.get(g.semester_id);
              return (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <span className="font-medium">
                      {crs ? `${crs.code} — ${crs.name}` : g.course_id}
                    </span>
                    <span className="mx-2 text-xs text-muted-foreground">
                      ({sem?.name_ar ?? ""})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                      {g.marks ?? "—"} · {g.grade_letter ?? "—"} ·{" "}
                      {g.is_published ? "Published" : "Draft"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await adminUpsertStudentGrade({
                            data: {
                              student_user_id: userId,
                              semester_id: g.semester_id,
                              course_id: g.course_id,
                              marks: g.marks,
                              grade_letter: g.grade_letter,
                              grade_points: g.grade_points,
                              status_label: g.status_label,
                              is_published: !g.is_published,
                            },
                          });
                          await refresh();
                          toast.success(
                            g.is_published ? "تم إخفاء النتيجة" : "تم نشر النتيجة للطالب",
                          );
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "تعذر التحديث");
                        }
                      }}
                    >
                      {g.is_published ? "إخفاء" : "نشر"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        try {
                          await adminDeleteStudentGrade({ data: { id: g.id } });
                          await refresh();
                          toast.success("تم حذف النتيجة");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "تعذر الحذف");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 border-t pt-5">
          <div className="mb-3 text-xs font-semibold text-muted-foreground">
            ملخص ومعدل الفصل الدراسي للطالب
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select
              className="rounded-lg border bg-background px-3 py-2 text-sm"
              value={sumSemesterId}
              onChange={(e) => setSumSemesterId(e.target.value)}
            >
              <option value="">الفصل الدراسي</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_ar}
                </option>
              ))}
            </select>
            <Input
              value={sumGpa}
              onChange={(e) => setSumGpa(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              max="4"
              placeholder="المعدل الفصلي (3.50)"
              dir="ltr"
            />
            <Button
              variant="outline"
              disabled={!sumSemesterId || savingSummary}
              onClick={async () => {
                setSavingSummary(true);
                try {
                  await adminUpsertSemesterGradeSummary({
                    data: {
                      student_user_id: userId,
                      semester_id: sumSemesterId,
                      semester_gpa: sumGpa.trim() ? Number(sumGpa) : null,
                      is_published: sumPublished,
                    },
                  });
                  await refresh();
                  toast.success("تم حفظ ملخص الفصل الدراسي");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "تعذر حفظ الملخص");
                } finally {
                  setSavingSummary(false);
                }
              }}
            >
              {savingSummary ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}{" "}
              حفظ الملخص
            </Button>
          </div>
          <label className="mb-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={sumPublished}
              onChange={(e) => setSumPublished(e.target.checked)}
            />
            إتاحة المعدل الفصلي للطالب
          </label>
          {(detail.data?.summaries.length ?? 0) > 0 && (
            <div className="divide-y text-sm">
              {detail.data?.summaries.map((sum) => {
                const sem = semesterMap.get(sum.semester_id);
                return (
                  <div
                    key={sum.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>{sem?.name_ar ?? sum.semester_id}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                        GPA: {sum.semester_gpa ?? "—"} · {sum.is_published ? "Published" : "Draft"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={async () => {
                          try {
                            await adminDeleteSemesterGradeSummary({ data: { id: sum.id } });
                            await refresh();
                            toast.success("تم حذف ملخص الفصل");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "تعذر الحذف");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{previewUrl?.title}</DialogTitle>
          </DialogHeader>
          {previewUrl && <LazyPdf url={previewUrl.url} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmSuspend} onOpenChange={(o) => !o && setConfirmSuspend(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmSuspend === "suspended" ? "تعليق حساب الطالب؟" : "إعادة تفعيل حساب الطالب؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmSuspend === "suspended"
                ? "سيتم منع الطالب فورًا من دخول البوابة والوصول إلى الملفات والنتائج."
                : "سيستعيد الطالب صلاحية الدخول وعرض بياناته وملفاته."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmSuspend) return;
                try {
                  await adminSetStudentAccountStatus({ data: { userId, status: confirmSuspend } });
                  setConfirmSuspend(null);
                  await refresh();
                  toast.success("تم تحديث حالة الحساب");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "تعذر تحديث حالة الحساب");
                }
              }}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
