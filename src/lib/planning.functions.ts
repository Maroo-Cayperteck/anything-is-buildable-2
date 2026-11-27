import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  planItemSchema,
  readPlanItems,
  validTime,
  validDate,
  parseRoster,
  dateDay,
} from "./planning-utils";
import { matchesChoice } from "./schedule-utils";
export const getPlanningCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireActiveStudentServer } = await import("./auth.server");
    await requireActiveStudentServer(context.userId, context.supabase);
    const db = context.supabase;
    const [courses, levels, semesters, offerings, slots, plans, exceptions, events] =
      await Promise.all([
        db.from("courses").select("*").eq("is_active", true).order("code"),
        db.from("academic_levels").select("*").order("level_number"),
        db
          .from("semesters")
          .select("*,academic_years(name)")
          .order("created_at", { ascending: false }),
        db.from("course_offerings").select("*"),
        db.from("schedule_slots").select("*").eq("is_deleted", false),
        db.from("personal_plans").select("*").eq("student_user_id", context.userId),
        db.from("schedule_exceptions").select("*"),
        db
          .from("personal_events")
          .select("*")
          .eq("student_user_id", context.userId)
          .order("event_date"),
      ]);
    if (
      [courses, levels, semesters, offerings, slots, plans, exceptions, events].some((x) => x.error)
    )
      throw new Error("تعذر تحميل إعدادات الجدول");
    return {
      courses: courses.data!,
      levels: levels.data!,
      semesters: semesters.data!,
      offerings: offerings.data!,
      slots: slots.data!,
      plans: plans.data!,
      exceptions: exceptions.data!,
      events: events.data!,
    };
  });
export const saveMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        levelId: z.string().uuid(),
        semesterId: z.string().uuid(),
        items: z.array(planItemSchema).min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireActiveStudentServer } = await import("./auth.server");
    await requireActiveStudentServer(context.userId, context.supabase);
    const { persistPersonalPlan } = await import("./planning.server");
    await persistPersonalPlan(context.userId, data.levelId, data.semesterId, data.items);
    return { ok: true };
  });
export const resetMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ semesterId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { requireActiveStudentServer } = await import("./auth.server");
    await requireActiveStudentServer(context.userId, context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: offs, error: oe } = await db
      .from("course_offerings")
      .select("id")
      .eq("semester_id", data.semesterId);
    if (oe || !offs.length) throw new Error("لا توجد خطة من المسؤول لهذا الفصل بعد");
    const { data: enrs, error: ee } = await db
      .from("enrollments")
      .select("id")
      .eq("student_user_id", context.userId)
      .eq("status", "enrolled")
      .in(
        "offering_id",
        offs.map((o) => o.id),
      );
    if (ee || !enrs?.length)
      throw new Error("لا توجد خطة من المسؤول لهذا الفصل بعد؛ احتفظ بخطتك الشخصية");
    const { error } = await db
      .from("personal_plans")
      .delete()
      .eq("student_user_id", context.userId)
      .eq("semester_id", data.semesterId);
    if (error) throw new Error("تعذر إعادة الخطة");
    return { ok: true };
  });
export const savePersonalEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        remove: z.boolean().default(false),
        title: z.string().trim().min(1).max(120),
        event_date: validDate,
        start_time: validTime,
        end_time: validTime,
        note: z.string().max(500),
      })
      .refine((d) => d.end_time > d.start_time, "راجع وقت النهاية")
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireActiveStudentServer } = await import("./auth.server");
    await requireActiveStudentServer(context.userId, context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { id, remove, ...values } = data;
    const result =
      remove && id
        ? await db
            .from("personal_events")
            .delete()
            .eq("id", id)
            .eq("student_user_id", context.userId)
        : id
          ? await db
              .from("personal_events")
              .update(values)
              .eq("id", id)
              .eq("student_user_id", context.userId)
          : await db.from("personal_events").insert({ ...values, student_user_id: context.userId });
    if (result.error) throw new Error("تعذر حفظ الحدث");
    return { ok: true };
  });
export const getAdminPlanning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [profiles, plans, enrollments, slots, history, exceptions, roster] = await Promise.all([
      db
        .from("student_profiles")
        .select(
          "user_id,student_code,full_name_ar,academic_status,cgpa,earned_hours,account_status",
        )
        .not("student_code", "is", null),
      db.from("personal_plans").select("*"),
      db.from("enrollments").select("*").eq("status", "enrolled"),
      db.from("schedule_slots").select("*").eq("is_deleted", false),
      db.from("schedule_history").select("*").order("created_at", { ascending: false }).limit(30),
      db.from("schedule_exceptions").select("*").order("occurrence_date", { ascending: false }),
      db.from("planning_roster").select("*"),
    ]);
    if ([profiles, plans, enrollments, slots, history, exceptions, roster].some((x) => x.error))
      throw new Error("تعذر تحميل مركز المتابعة");
    return {
      profiles: profiles.data!,
      plans: plans.data!,
      enrollments: enrollments.data!,
      slots: slots.data!,
      history: history.data!,
      exceptions: exceptions.data!,
      roster: roster.data!,
    };
  });
export const importPlanningRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ text: z.string().max(300000), semesterId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer, logAdminActivity } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const rows = parseRoster(data.text);
    if (!rows.length || rows.some((r) => r.errors.length))
      throw new Error("صحح أخطاء المعاينة قبل الاستيراد");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [{ data: program, error: pe }, { data: sem, error: se }] = await Promise.all([
      db.from("academic_programs").select("id").eq("code", "NCSE").single(),
      db.from("semesters").select("id").eq("id", data.semesterId).eq("is_closed", false).single(),
    ]);
    if (pe || se || !program || !sem) throw new Error("الفصل غير متاح");
    const { data: levels, error: le } = await db
      .from("academic_levels")
      .select("*")
      .eq("program_id", program.id);
    if (le) throw new Error("تعذر قراءة المستويات");
    const values = rows.map((r) => {
      const level = levels!.find((l) => l.level_number === r.level);
      if (!level) throw new Error("المستوى غير متاح");
      return {
        student_code: r.student_code,
        level_id: level.id,
        semester_id: data.semesterId,
        group_number: r.group_number,
        section_number: r.section_number,
        lab_number: r.lab_number,
        updated_at: new Date().toISOString(),
      };
    });
    const { error } = await db.from("planning_roster").upsert(values);
    if (error) throw new Error("تعذر حفظ الكشف");
    await logAdminActivity({
      actorUserId: context.userId,
      action: "import_planning_roster",
      entityType: "planning_roster",
      metadata: { count: values.length },
    });
    return { count: values.length };
  });
export const applyRosterPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        semesterId: z.string().uuid(),
        studentIds: z.array(z.string().uuid()).min(1).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireActiveStudentServer, requireAdminServer, logAdminActivity } =
      await import("./auth.server");
    if (data.studentIds) await requireAdminServer(context.userId);
    else await requireActiveStudentServer(context.userId, context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { persistPersonalPlan } = await import("./planning.server");
    const { suggestedCodes } = await import("./planning-utils");
    const { data: sem, error: se } = await db
      .from("semesters")
      .select("*")
      .eq("id", data.semesterId)
      .single();
    if (se || !sem) throw new Error("الفصل غير متاح");
    const result: { id: string; ok: boolean; message: string }[] = [];
    for (const id of data.studentIds ?? [context.userId]) {
      try {
        const { data: p, error: pe } = await db
          .from("student_profiles")
          .select("student_code")
          .eq("user_id", id)
          .single();
        if (pe || !p?.student_code) throw new Error("ليس حساب طالب");
        const { data: r, error: re } = await db
          .from("planning_roster")
          .select("*")
          .eq("student_code", p.student_code)
          .eq("semester_id", data.semesterId)
          .single();
        if (re || !r) throw new Error("لا يوجد توزيع في الكشف لهذا الفصل");
        const { data: l } = await db
          .from("academic_levels")
          .select("level_number")
          .eq("id", r.level_id)
          .single();
        const { data: c, error: ce } = await db
          .from("courses")
          .select("id")
          .in("code", suggestedCodes(l!.level_number, sem.season === "SPRING" ? 2 : 1));
        if (ce) throw new Error("تعذر قراءة المواد");
        await persistPersonalPlan(
          id,
          r.level_id,
          data.semesterId,
          c!.map((x) => ({
            courseId: x.id,
            group_number: r.group_number,
            section_number: r.section_number,
            lab_number: r.lab_number,
          })),
        );
        result.push({ id, ok: true, message: "تم تطبيق توزيع الكشف" });
      } catch (e) {
        result.push({ id, ok: false, message: e instanceof Error ? e.message : "تعذر التطبيق" });
      }
    }
    if (data.studentIds)
      await logAdminActivity({
        actorUserId: context.userId,
        action: "apply_roster_plans",
        entityType: "personal_plans",
        metadata: { count: result.filter((r) => r.ok).length },
      });
    return result;
  });
export const saveScheduleException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slotId: z.string().uuid(),
        occurrenceDate: validDate,
        cancelled: z.boolean(),
        replacementDate: validDate.optional(),
        start: validTime.optional(),
        end: validTime.optional(),
        room: z.string().trim().max(200).optional(),
        note: z.string().trim().max(500),
        remove: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: slot, error: se } = await db
      .from("schedule_slots")
      .select("day_of_week")
      .eq("id", data.slotId)
      .eq("is_deleted", false)
      .single();
    if (se || !slot) throw new Error("الموعد غير موجود");
    if (!data.remove && dateDay(data.occurrenceDate) !== slot.day_of_week)
      throw new Error("تاريخ المحاضرة الأصلية لا يوافق يومها في الجدول");
    if (
      !data.remove &&
      !data.cancelled &&
      (!data.replacementDate || !data.start || !data.end || data.end <= data.start || !data.room)
    )
      throw new Error("أكمل الموعد التعويضي");
    const result = data.remove
      ? await db
          .from("schedule_exceptions")
          .delete()
          .eq("slot_id", data.slotId)
          .eq("occurrence_date", data.occurrenceDate)
      : await db.from("schedule_exceptions").upsert(
          {
            slot_id: data.slotId,
            occurrence_date: data.occurrenceDate,
            cancelled: data.cancelled,
            replacement_date: data.cancelled ? null : (data.replacementDate ?? null),
            start_time: data.cancelled ? null : (data.start ?? null),
            end_time: data.cancelled ? null : (data.end ?? null),
            location: data.cancelled ? null : (data.room ?? null),
            note: data.note,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slot_id,occurrence_date" },
        );
    if (result.error) throw new Error("تعذر حفظ الاستثناء");
    return { ok: true };
  });
export const undoScheduleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ historyId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.rpc("undo_schedule_slot", {
      p_actor: context.userId,
      p_history: data.historyId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const getScheduleImpact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slotId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await db
      .from("schedule_slots")
      .select("*")
      .eq("id", data.slotId)
      .single();
    if (error || !s) throw new Error("الموعد غير موجود");
    const [{ data: e, error: ee }, { data: p, error: pe }] = await Promise.all([
      db.from("enrollments").select("*").eq("offering_id", s.offering_id).eq("status", "enrolled"),
      db.from("personal_plans").select("*"),
    ]);
    if (ee || pe) throw new Error("تعذر حساب التأثير");
    const ids = new Set((e ?? []).filter((x) => matchesChoice(s, x)).map((x) => x.student_user_id));
    for (const plan of p ?? [])
      if (
        readPlanItems(plan.items).some((x) => x.offeringId === s.offering_id && matchesChoice(s, x))
      )
        ids.add(plan.student_user_id);
    return { count: ids.size, version: s.version };
  });
