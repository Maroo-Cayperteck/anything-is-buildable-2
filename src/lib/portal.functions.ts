import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatTimeDisplay, parseTimeToMinutes } from "./auth-helpers";

export const getStudentPortalSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semesterId: z.string().uuid().optional() }).optional().parse(d),
  )
  .handler(async ({ context, data }) => {
    const { matchesStudentAudience, requireActiveStudentServer } = await import("./auth.server");
    // Student-facing reads MUST execute through the user-scoped JWT client so PostgreSQL RLS is enforced.
    const db = context.supabase;

    const student = await requireActiveStudentServer(context.userId, db);

    const [progRes, lvlRes, yearRes, semRes, enrRes, annRes, evRes, gradeRes, sumRes] =
      await Promise.all([
        student.program_id
          ? db.from("academic_programs").select("*").eq("id", student.program_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        student.level_id
          ? db.from("academic_levels").select("*").eq("id", student.level_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        student.academic_year_id
          ? db.from("academic_years").select("*").eq("id", student.academic_year_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        db
          .from("semesters")
          .select("*, academic_years(name)")
          .order("created_at", { ascending: false }),
        db
          .from("enrollments")
          .select("*")
          .eq("student_user_id", student.user_id)
          .eq("status", "enrolled"),
        db
          .from("announcements")
          .select("*")
          .eq("is_published", true)
          .eq("is_archived", false)
          .order("published_at", { ascending: false }),
        db
          .from("academic_events")
          .select("*")
          .eq("is_published", true)
          .order("starts_at", { ascending: true }),
        db
          .from("student_grades")
          .select("*")
          .eq("student_user_id", student.user_id)
          .eq("is_published", true)
          .order("created_at", { ascending: true }),
        db
          .from("semester_grade_summaries")
          .select("*")
          .eq("student_user_id", student.user_id)
          .eq("is_published", true),
      ]);

    const firstError =
      progRes.error ||
      lvlRes.error ||
      yearRes.error ||
      semRes.error ||
      enrRes.error ||
      annRes.error ||
      evRes.error ||
      gradeRes.error ||
      sumRes.error;

    if (firstError) {
      console.error("[portal] snapshot primary query failed", { code: firstError.code });
      throw new Error("تعذر تحميل البيانات الأكاديمية من قاعدة البيانات");
    }

    const semesters = semRes.data ?? [];
    const enrollments = enrRes.data ?? [];
    const announcements = annRes.data ?? [];
    const events = evRes.data ?? [];
    const grades = gradeRes.data ?? [];
    const gradeSummaries = sumRes.data ?? [];

    const selectedSemester =
      (data?.semesterId ? semesters.find((s) => s.id === data.semesterId) : undefined) ??
      semesters.find((s) => s.is_current) ??
      semesters[0] ??
      null;

    // Resolve enrolled courses, offerings, groups, and lectures under RLS
    const offeringIds = [...new Set(enrollments.map((e) => e.offering_id))];
    const groupIds = [...new Set(enrollments.map((e) => e.group_id))];

    const [offRes, grpRes, lecRes] = await Promise.all([
      offeringIds.length > 0
        ? db.from("course_offerings").select("*").in("id", offeringIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length > 0
        ? db.from("academic_groups").select("*").in("id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length > 0
        ? db
            .from("lectures")
            .select("*")
            .in("group_id", groupIds)
            .order("start_time", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (offRes.error || grpRes.error || lecRes.error) {
      const err = offRes.error || grpRes.error || lecRes.error;
      console.error("[portal] snapshot detail query failed", { code: err?.code });
      throw new Error("تعذر تحميل تفاصيل المقررات والجدول الدراسي");
    }

    const offerings = offRes.data ?? [];
    const groups = grpRes.data ?? [];
    const lectures = lecRes.data ?? [];
    const { matchesChoice } = await import("./schedule-utils");
    const [slotRes, overrideRes] = await Promise.all([
      offeringIds.length
        ? db.from("schedule_slots").select("*").in("offering_id", offeringIds)
        : Promise.resolve({ data: [], error: null }),
      db.from("schedule_overrides").select("*").eq("student_user_id", student.user_id),
    ]);
    if (slotRes.error || overrideRes.error) throw new Error("تعذر تحميل تعديلات الجدول");
    const baseSlots = slotRes.data ?? [],
      overrides = overrideRes.data ?? [];

    const courseIds = [
      ...new Set([...offerings.map((o) => o.course_id), ...grades.map((g) => g.course_id)]),
    ];
    const courseRes =
      courseIds.length > 0
        ? await db.from("courses").select("*").in("id", courseIds)
        : { data: [], error: null };

    if (courseRes.error) {
      console.error("[portal] courses lookup failed", { code: courseRes.error.code });
      throw new Error("تعذر تحميل بيانات المقررات الدراسية");
    }

    const courseMap = new Map((courseRes.data ?? []).map((c) => [c.id, c]));
    const offeringMap = new Map(offerings.map((o) => [o.id, o]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const semesterMap = new Map(semesters.map((s) => [s.id, s]));

    const activeEnrollments = enrollments
      .map((e) => {
        const off = offeringMap.get(e.offering_id);
        const grp = groupMap.get(e.group_id);
        const crs = off ? courseMap.get(off.course_id) : undefined;
        const sem = off ? semesterMap.get(off.semester_id) : undefined;
        const templateSlots = baseSlots.filter((l) => l.offering_id === e.offering_id);
        const grpLectures = (
          e.group_number
            ? templateSlots
                .filter((l) => matchesChoice(l, e))
                .map((l) => ({
                  ...l,
                  group_id: e.group_id,
                  start_hour: Number(l.start_time.slice(0, 2)),
                  end_hour: Number(l.end_time.slice(0, 2)),
                }))
            : lectures.filter((l) => l.group_id === e.group_id)
        ).map((l) => {
          const personal = overrides.find((o) => o.slot_id === l.id && o.scope === "personal");
          const adminOverride = overrides.find((o) => o.slot_id === l.id && o.scope === "admin");
          const change = personal ?? adminOverride;
          return {
            ...l,
            ...(change
              ? {
                  day_of_week: change.day_of_week,
                  start_time: change.start_time,
                  end_time: change.end_time,
                  location: change.location,
                  start_hour: Number(change.start_time.slice(0, 2)),
                  end_hour: Number(change.end_time.slice(0, 2)),
                }
              : {}),
            isPersonal: !!personal,
            isAdminOverride: !!adminOverride,
          };
        });
        return {
          enrollmentId: e.id,
          status: e.status,
          offeringId: e.offering_id,
          semesterId: off?.semester_id ?? null,
          semesterName: sem?.name_ar ?? null,
          courseId: crs?.id ?? null,
          courseCode: crs?.code ?? "",
          courseName: crs?.name ?? "",
          courseNameAr: crs?.name_ar ?? null,
          creditHours: crs?.credit_hours ?? 0,
          groupId: grp?.id ?? e.group_id,
          groupName: grp?.name ?? "",
          instructor: grp?.instructor ?? null,
          lectures: grpLectures,
        };
      })
      .filter((item) => (!selectedSemester ? true : item.semesterId === selectedSemester.id));

    const timetableSlots = activeEnrollments.flatMap((enr) =>
      enr.lectures.map((lec) => {
        const startTime = formatTimeDisplay(lec.start_time, lec.start_hour);
        const endTime = formatTimeDisplay(lec.end_time, lec.end_hour);
        return {
          id: lec.id,
          isPersonal: lec.isPersonal,
          isAdminOverride: lec.isAdminOverride,
          day: lec.day_of_week,
          start: lec.start_hour,
          end: lec.end_hour,
          startTime,
          endTime,
          startMinutes: parseTimeToMinutes(startTime, lec.start_hour),
          endMinutes: parseTimeToMinutes(endTime, lec.end_hour),
          kind: lec.kind,
          course: enr.courseName,
          courseCode: enr.courseCode,
          groupName: enr.groupName,
          staff: lec.instructor || enr.instructor || "—",
          room: lec.location,
        };
      }),
    );

    const weekdayOrder = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    timetableSlots.sort((a, b) =>
      weekdayOrder.indexOf(a.day) - weekdayOrder.indexOf(b.day) ||
      a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
    );
    const targetedAnnouncements = announcements.filter((a) => matchesStudentAudience(a, student));
    const targetedEvents = events.filter((ev) => matchesStudentAudience(ev, student));

    const publishedGrades = grades.map((g) => {
      const crs = courseMap.get(g.course_id);
      const sem = semesterMap.get(g.semester_id);
      return {
        ...g,
        courseCode: crs?.code ?? "—",
        courseName: crs?.name ?? "—",
        creditHours: crs?.credit_hours ?? 0,
        semesterName: sem?.name_ar ?? "—",
        semesterSeason: sem?.season ?? "",
        academicYearName:
          (sem as { academic_years?: { name?: string } } | undefined)?.academic_years?.name ?? "",
      };
    });

    return {
      profile: {
        ...student,
        resolvedProgramName: progRes.data?.name_ar ?? student.program,
        resolvedFacultyName: progRes.data?.faculty ?? student.faculty,
        resolvedLevelName: lvlRes.data?.name_ar ?? student.academic_level,
        resolvedYearName: yearRes.data?.name ?? student.academic_year,
      },
      semesters,
      selectedSemester,
      enrollments: activeEnrollments,
      timetable: timetableSlots,
      announcements: targetedAnnouncements,
      events: targetedEvents,
      grades: publishedGrades,
      gradeSummaries,
    };
  });

export const getStudentDocumentsBundle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { matchesStudentAudience, requireActiveStudentServer } = await import("./auth.server");
    const db = context.supabase;

    const student = await requireActiveStudentServer(context.userId, db);

    const [{ data: sharedDocs, error: sharedErr }, { data: privateDocs, error: privErr }] =
      await Promise.all([
        db
          .from("documents")
          .select("*")
          .eq("is_available", true)
          .order("sort_order", { ascending: true }),
        db
          .from("student_documents")
          .select("*")
          .eq("student_user_id", student.user_id)
          .eq("is_available", true)
          .order("created_at", { ascending: false }),
      ]);

    if (sharedErr || privErr) {
      const err = sharedErr || privErr;
      console.error("[portal] documents bundle query failed", { code: err?.code });
      throw new Error("تعذر تحميل الملفات من قاعدة البيانات");
    }

    return {
      shared: (sharedDocs ?? []).filter((doc) => matchesStudentAudience(doc, student)),
      privateDocs: privateDocs ?? [],
    };
  });
