import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validTime as time, readPlanItems } from "./planning-utils";
const day = z.enum(["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]);
const slotFields = {
  day_of_week: day,
  start_time: time,
  end_time: time,
  location: z.string().trim().min(1).max(200),
};
export const getScheduleAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [slots, requests, overrides] = await Promise.all([
      db.from("schedule_slots").select("*").eq("is_deleted", false),
      db
        .from("schedule_requests")
        .select("*, student_profiles(full_name_ar,student_code)")
        .order("created_at", { ascending: false }),
      db.from("schedule_overrides").select("*"),
    ]);
    if (slots.error || requests.error || overrides.error)
      throw new Error("تعذر تحميل بيانات الجدول");
    return { slots: slots.data, requests: requests.data, overrides: overrides.data };
  });
export const saveScheduleSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        expectedVersion: z.number().int().optional(),
        offering_id: z.string().uuid(),
        ...slotFields,
        kind: z.enum(["lecture", "section", "lab"]),
        instructor: z.string().max(200).nullable(),
        group_number: z.number().int().min(1).max(20).nullable(),
        section_number: z.number().int().min(1).max(30).nullable(),
        lab_number: z.number().int().min(1).max(30).nullable(),
      })
      .refine((d) => d.end_time > d.start_time, "وقت النهاية يجب أن يلي البداية")
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer, logAdminActivity } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { id, expectedVersion, ...values } = data;
    const { error } = data.id
      ? await db.rpc("change_schedule_slot", {
          p_actor: context.userId,
          p_id: data.id,
          p_expected: expectedVersion ?? 0,
          p_values: values,
        })
      : await db.from("schedule_slots").insert({ ...values, source: "admin" });
    if (error) throw new Error(error.message);
    await logAdminActivity({
      actorUserId: context.userId,
      action: "save_schedule_slot",
      entityType: "schedule_slots",
      entityId: data.id ?? null,
    });
    return { ok: true };
  });
export const deleteScheduleSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: slot } = await db
      .from("schedule_slots")
      .select("version")
      .eq("id", data.id)
      .single();
    const { error } = await db.rpc("change_schedule_slot", {
      p_actor: context.userId,
      p_id: data.id,
      p_expected: slot?.version ?? 0,
      p_values: { is_deleted: true },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const applyStudentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        levelId: z.string().uuid(),
        semesterId: z.string().uuid(),
        courseIds: z.array(z.string().uuid()).min(1).max(20),
        group: z.number().int().min(1).max(20),
        section: z.number().int().min(1).max(30),
        lab: z.number().int().min(1).max(30),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.rpc("apply_student_plan", {
      p_actor: context.userId,
      p_student: data.studentId,
      p_level: data.levelId,
      p_semester: data.semesterId,
      p_courses: [...new Set(data.courseIds)],
      p_group: data.group,
      p_section: data.section,
      p_lab: data.lab,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const sendScheduleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ message: z.string().trim().min(5).max(2000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireActiveStudentServer } = await import("./auth.server");
    await requireActiveStudentServer(context.userId, context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await db
      .from("schedule_requests")
      .select("id", { count: "exact", head: true })
      .eq("student_user_id", context.userId)
      .eq("status", "pending");
    if (countError) throw new Error("تعذر التحقق من الطلبات");
    if ((count ?? 0) >= 3) throw new Error("لديك 3 طلبات قيد المراجعة بالفعل");
    const { error } = await db
      .from("schedule_requests")
      .insert({ student_user_id: context.userId, message: data.message });
    if (error) throw new Error("تعذر إرسال الطلب");
    return { ok: true };
  });
export const respondScheduleRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["resolved", "rejected"]),
        reply: z.string().trim().min(3).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db
      .from("schedule_requests")
      .update({
        status: data.status,
        admin_reply: data.reply,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error("تعذر حفظ الرد");
    return { ok: true };
  });
export const getMyScheduleChanges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireActiveStudentServer } = await import("./auth.server");
    await requireActiveStudentServer(context.userId, context.supabase);
    const { data, error } = await context.supabase
      .from("schedule_requests")
      .select("*")
      .eq("student_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل الطلبات");
    return data;
  });
export const saveScheduleOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid().optional(),
        slotId: z.string().uuid(),
        reset: z.boolean().default(false),
        ...slotFields,
      })
      .refine((d) => d.end_time > d.start_time, "راجع ترتيب الوقت")
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer, requireActiveStudentServer } = await import("./auth.server");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const studentId = data.studentId ?? context.userId;
    const scope = data.studentId ? "admin" : "personal";
    if (data.studentId) await requireAdminServer(context.userId);
    else await requireActiveStudentServer(context.userId, context.supabase);
    const { data: enrollments, error: ee } = await db
      .from("enrollments")
      .select("offering_id,group_id,group_number,section_number,lab_number")
      .eq("student_user_id", studentId)
      .eq("status", "enrolled");
    if (ee) throw new Error("تعذر التحقق من التسجيل");
    const [{ data: slot }, { data: legacy }] = await Promise.all([
      db.from("schedule_slots").select("*").eq("id", data.slotId).maybeSingle(),
      db.from("lectures").select("*").eq("id", data.slotId).maybeSingle(),
    ]);
    const { data: plans, error: planError } = await db
      .from("personal_plans")
      .select("items,semester_id")
      .eq("student_user_id", studentId);
    if (planError) throw new Error("تعذر قراءة الخطة الشخصية");
    const personalMatch =
      slot &&
      (plans ?? []).some((p) =>
        readPlanItems(p.items).some((x) => x.offeringId === slot.offering_id),
      );
    const { matchesChoice } = await import("./schedule-utils");
    if (
      !personalMatch &&
      !enrollments?.some((e) =>
        slot
          ? e.offering_id === slot.offering_id && matchesChoice(slot, e)
          : legacy?.group_id === e.group_id,
      )
    )
      throw new Error("الموعد ليس ضمن جدول الطالب");
    const result = data.reset
      ? await db
          .from("schedule_overrides")
          .delete()
          .match({ student_user_id: studentId, slot_id: data.slotId, scope })
      : await db.from("schedule_overrides").upsert(
          {
            student_user_id: studentId,
            slot_id: data.slotId,
            scope,
            day_of_week: data.day_of_week,
            start_time: data.start_time,
            end_time: data.end_time,
            location: data.location,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_user_id,slot_id,scope" },
        );
    if (result.error) throw new Error("تعذر حفظ الموعد");
    return { ok: true };
  });
export const adminResetStudentPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ studentId: z.string().uuid(), password: z.string().min(8).max(128) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer, logAdminActivity } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { replaceStudentPassword } = await import("./password-recovery.server");
    await replaceStudentPassword(data.studentId, data.password);
    await logAdminActivity({
      actorUserId: context.userId,
      action: "reset_student_password",
      entityType: "student_profiles",
      entityId: data.studentId,
    });
    return { ok: true };
  });

export const setCourseDistribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enrollmentId: z.string().uuid(),
        group: z.number().int().min(1).max(20),
        section: z.number().int().min(1).max(30),
        lab: z.number().int().min(1).max(30),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer, logAdminActivity } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: enr, error } = await db
      .from("enrollments")
      .select("*")
      .eq("id", data.enrollmentId)
      .eq("status", "enrolled")
      .single();
    if (error || !enr) throw new Error("التسجيل غير نشط");
    const { data: group, error: ge } = await db
      .from("academic_groups")
      .upsert(
        { offering_id: enr.offering_id, name: `G${data.group} / S${data.section} / L${data.lab}` },
        { onConflict: "offering_id,name" },
      )
      .select("id")
      .single();
    if (ge || !group) throw new Error("تعذر تجهيز المجموعة");
    const { error: ue } = await db
      .from("enrollments")
      .update({
        group_id: group.id,
        group_number: data.group,
        section_number: data.section,
        lab_number: data.lab,
      })
      .eq("id", enr.id);
    if (ue) throw new Error(ue.message);
    await logAdminActivity({
      actorUserId: context.userId,
      action: "set_course_distribution",
      entityType: "enrollments",
      entityId: enr.id,
      metadata: { group: data.group, section: data.section, lab: data.lab },
    });
    return { ok: true };
  });
