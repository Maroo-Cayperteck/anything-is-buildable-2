import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeEmail,
  normalizeStudentCode,
  normalizeTimeString,
  parseTimeToMinutes,
} from "./auth-helpers";

const audienceSchema = z.enum(["all", "program", "level", "student"]);

async function assertProgramLevelMatch(
  programId: string | null | undefined,
  levelId: string | null | undefined,
) {
  if (!levelId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lvl, error } = await supabaseAdmin
    .from("academic_levels")
    .select("id, program_id")
    .eq("id", levelId)
    .maybeSingle();
  if (error || !lvl) {
    throw new Error("المستوى الأكاديمي المختار غير موجود");
  }
  if (programId && lvl.program_id !== programId) {
    throw new Error("المستوى الأكاديمي لا يتبع البرنامج الأكاديمي المحدد");
  }
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    const nowIso = new Date().toISOString();
    const [
      { count: totalStudents, error: e1 },
      { count: activeStudents, error: e2 },
      { count: pendingRegistrations, error: e3 },
      { count: suspendedStudents, error: e4 },
      { count: programsCount, error: e5 },
      { count: activeSemestersCount, error: e6 },
      { count: coursesCount, error: e7 },
      { count: offeringsCount, error: e8 },
      { count: publishedDocuments, error: e9 },
      { count: upcomingEvents, error: e10 },
      { data: recentLogs, error: e11 },
    ] = await Promise.all([
      supabaseAdmin.from("student_profiles").select("*", { count: "exact", head: true }).not("student_code", "is", null),
      supabaseAdmin
        .from("student_profiles")
        .select("*", { count: "exact", head: true })
        .eq("account_status", "active"),
      supabaseAdmin
        .from("registration_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("student_profiles")
        .select("*", { count: "exact", head: true })
        .eq("account_status", "suspended"),
      supabaseAdmin.from("academic_programs").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("semesters")
        .select("*", { count: "exact", head: true })
        .eq("is_current", true),
      supabaseAdmin.from("courses").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("course_offerings").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("is_available", true),
      supabaseAdmin
        .from("academic_events")
        .select("*", { count: "exact", head: true })
        .eq("is_published", true)
        .gte("starts_at", nowIso),
      supabaseAdmin
        .from("admin_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10 || e11) {
      throw new Error("تعذر تحميل إحصائيات لوحة التحكم");
    }

    return {
      counts: {
        totalStudents: totalStudents ?? 0,
        activeStudents: activeStudents ?? 0,
        pendingRegistrations: pendingRegistrations ?? 0,
        suspendedStudents: suspendedStudents ?? 0,
        programsCount: programsCount ?? 0,
        activeSemestersCount: activeSemestersCount ?? 0,
        coursesCount: coursesCount ?? 0,
        offeringsCount: offeringsCount ?? 0,
        publishedDocuments: publishedDocuments ?? 0,
        upcomingEvents: upcomingEvents ?? 0,
      },
      recentLogs: recentLogs ?? [],
    };
  });

export const listRosterAndRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    const [{ data: roster, error: rErr }, { data: requests, error: qErr }] = await Promise.all([
      supabaseAdmin
        .from("student_roster")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("registration_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (rErr || qErr) throw new Error("تعذر تحميل كشف المؤهلين وطلبات التسجيل");
    return { roster: roster ?? [], requests: requests ?? [] };
  });

const rosterInputSchema = z.object({
  id: z.string().uuid().optional(),
  student_code: z.string().trim().min(2).max(40),
  approved_email: z.string().trim().email().max(160),
  full_name_ar: z.string().trim().max(160).optional().default(""),
  full_name_en: z.string().trim().max(160).optional().default(""),
  program_id: z.string().uuid().nullable().optional().default(null),
  level_id: z.string().uuid().nullable().optional().default(null),
  is_active: z.boolean().optional().default(true),
});

export const adminUpsertRosterEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rosterInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    await assertProgramLevelMatch(data.program_id, data.level_id);

    const payload = {
      student_code: normalizeStudentCode(data.student_code),
      approved_email: normalizeEmail(data.approved_email),
      full_name_ar: data.full_name_ar || null,
      full_name_en: data.full_name_en || null,
      program_id: data.program_id,
      level_id: data.level_id,
      is_active: data.is_active,
    };

    const res = data.id
      ? await supabaseAdmin
          .from("student_roster")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("student_roster").insert(payload).select("*").single();

    if (res.error || !res.data) {
      throw new Error(
        res.error?.message ||
          "تعذر حفظ بيانات الطالب المؤهل (تأكد من عدم تكرار الرقم الجامعي أو البريد)",
      );
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_roster" : "create_roster",
      entityType: "student_roster",
      entityId: res.data.id,
      metadata: { student_code: res.data.student_code },
    });

    return res.data;
  });

export const adminBulkImportRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              student_code: z.string().trim().min(2).max(40),
              approved_email: z.string().trim().email().max(160),
              full_name_ar: z.string().trim().max(160).optional().default(""),
              full_name_en: z.string().trim().max(160).optional().default(""),
              program_id: z.string().uuid().nullable().optional().default(null),
              level_id: z.string().uuid().nullable().optional().default(null),
            }),
          )
          .min(1, "يرجى إدخال سجل واحد على الأقل للاستيراد")
          .max(500, "الحد الأقصى للاستيراد في الدفعة الواحدة 500 طالب"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const seenCodes = new Set<string>();
    const seenEmails = new Set<string>();
    const normalizedRows = [];

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i]!;
      const code = normalizeStudentCode(row.student_code);
      const email = normalizeEmail(row.approved_email);
      if (seenCodes.has(code)) {
        throw new Error(`الرقم الجامعي مكرر داخل الملف في الصف ${i + 1}: ${code}`);
      }
      if (seenEmails.has(email)) {
        throw new Error(`البريد الإلكتروني مكرر داخل الملف في الصف ${i + 1}: ${email}`);
      }
      seenCodes.add(code);
      seenEmails.add(email);
      await assertProgramLevelMatch(row.program_id, row.level_id);
      normalizedRows.push({
        student_code: code,
        approved_email: email,
        full_name_ar: row.full_name_ar || null,
        full_name_en: row.full_name_en || null,
        program_id: row.program_id ?? null,
        level_id: row.level_id ?? null,
        is_active: true,
      });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("student_roster")
      .upsert(normalizedRows, { onConflict: "student_code" })
      .select("id");

    if (error) {
      throw new Error(
        error.message || "تعذر استيراد كشف الطلاب (تأكد من عدم تعارض البريد الإلكتروني)",
      );
    }

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "bulk_import_roster",
      entityType: "student_roster",
      metadata: { imported_count: inserted?.length ?? normalizedRows.length },
    });

    return { importedCount: inserted?.length ?? normalizedRows.length };
  });

export const adminDeleteRosterEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin.from("student_roster").delete().eq("id", data.id);
    if (error) throw new Error("تعذر حذف السجل (قد يكون مرتبطًا بطلب تسجيل)");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "delete_roster",
      entityType: "student_roster",
      entityId: data.id,
    });

    return { ok: true as const };
  });

export const adminApproveRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        programId: z.string().uuid().nullable().optional(),
        levelId: z.string().uuid().nullable().optional(),
        academicYearId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    await assertProgramLevelMatch(data.programId, data.levelId);

    const { error } = await supabaseAdmin.rpc("admin_approve_registration_atomic", {
      _request_id: data.requestId,
      _actor_user_id: admin.userId,
      _actor_label: admin.actorLabel,
      _program_id: data.programId ?? null,
      _level_id: data.levelId ?? null,
      _academic_year_id: data.academicYearId ?? null,
    });

    if (error) {
      throw new Error(error.message || "تعذر اعتماد طلب التسجيل بشكل ذري");
    }

    return { ok: true as const };
  });

export const adminRejectRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ requestId: z.string().uuid(), reason: z.string().trim().max(500).optional() })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin.rpc("admin_reject_registration_atomic", {
      _request_id: data.requestId,
      _actor_user_id: admin.userId,
      _actor_label: admin.actorLabel,
      _reason: data.reason ?? null,
    });

    if (error) {
      throw new Error(error.message || "تعذر رفض طلب التسجيل");
    }

    return { ok: true as const };
  });

const listStudentsSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  programId: z.string().uuid().optional().or(z.literal("")),
  levelId: z.string().uuid().optional().or(z.literal("")),
  academicYearId: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["pending", "active", "rejected", "suspended"]).optional().or(z.literal("")),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(5).max(200).optional().default(20),
});

export const listAdminStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listStudentsSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    let query = supabaseAdmin.from("student_profiles").select("*", { count: "exact" }).not("student_code", "is", null);
    if (data.programId) query = query.eq("program_id", data.programId);
    if (data.levelId) query = query.eq("level_id", data.levelId);
    if (data.academicYearId) query = query.eq("academic_year_id", data.academicYearId);
    if (data.status) query = query.eq("account_status", data.status);
    if (data.search) {
      const safe = data.search.replace(/[,%()]/g, " ").trim();
      if (safe) {
        query = query.or(
          `full_name_ar.ilike.%${safe}%,full_name_en.ilike.%${safe}%,student_code.ilike.%${safe}%,email.ilike.%${safe}%`,
        );
      }
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const {
      data: items,
      count,
      error,
    } = await query.order("created_at", { ascending: false }).range(from, to);

    if (error) throw new Error("تعذر تحميل قائمة الطلاب");

    return {
      items: items ?? [],
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const getAdminStudentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    const [
      { data: profile, error: pErr },
      { data: privateDocs, error: docErr },
      { data: enrollments, error: enrErr },
      { data: grades, error: gradeErr },
      { data: summaries, error: sumErr },
    ] = await Promise.all([
      supabaseAdmin.from("student_profiles").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin
        .from("student_documents")
        .select("*")
        .eq("student_user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("enrollments")
        .select("*")
        .eq("student_user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("student_grades")
        .select("*")
        .eq("student_user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("semester_grade_summaries").select("*").eq("student_user_id", data.userId),
    ]);

    if (pErr || docErr || enrErr || gradeErr || sumErr) {
      throw new Error("تعذر تحميل تفاصيل سجل الطالب من قاعدة البيانات");
    }
    if (!profile) throw new Error("ملف الطالب غير موجود");

    return {
      profile,
      privateDocs: privateDocs ?? [],
      enrollments: enrollments ?? [],
      grades: grades ?? [],
      summaries: summaries ?? [],
    };
  });

const updateStudentSchema = z.object({
  user_id: z.string().uuid(),
  full_name_ar: z.string().trim().min(2).max(160),
  full_name_en: z.string().trim().max(160).nullable().optional(),
  student_code: z.string().trim().min(2).max(40),
  email: z.string().trim().email().max(160).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  gender: z.string().trim().max(20).nullable().optional(),
  program_id: z.string().uuid().nullable().optional(),
  level_id: z.string().uuid().nullable().optional(),
  academic_year_id: z.string().uuid().nullable().optional(),
  academic_status: z.string().trim().max(80).nullable().optional(),
  cgpa: z.number().min(0).max(4).nullable().optional(),
  earned_hours: z.number().int().min(0).max(400).nullable().optional(),
});

export const adminUpdateStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateStudentSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    await assertProgramLevelMatch(data.program_id, data.level_id);

    const { data: dup, error: dupErr } = await supabaseAdmin
      .from("student_profiles")
      .select("user_id")
      .eq("student_code", data.student_code)
      .neq("user_id", data.user_id)
      .maybeSingle();
    if (dupErr) throw new Error("تعذر التحقق من عدم تكرار الرقم الجامعي");
    if (dup) throw new Error("الرقم الجامعي مستخدم بالفعل لطالب آخر");

    let programName: string | null = null;
    let facultyName: string | null = null;
    let levelName: string | null = null;
    let yearName: string | null = null;

    if (data.program_id) {
      const { data: prog } = await supabaseAdmin
        .from("academic_programs")
        .select("name_ar, faculty")
        .eq("id", data.program_id)
        .maybeSingle();
      programName = prog?.name_ar ?? null;
      facultyName = prog?.faculty ?? null;
    }
    if (data.level_id) {
      const { data: lvl } = await supabaseAdmin
        .from("academic_levels")
        .select("name_ar")
        .eq("id", data.level_id)
        .maybeSingle();
      levelName = lvl?.name_ar ?? null;
    }
    if (data.academic_year_id) {
      const { data: yr } = await supabaseAdmin
        .from("academic_years")
        .select("name")
        .eq("id", data.academic_year_id)
        .maybeSingle();
      yearName = yr?.name ?? null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("student_profiles")
      .update({
        full_name_ar: data.full_name_ar,
        full_name_en: data.full_name_en ?? null,
        student_code: data.student_code,
        username: data.student_code,
        email: data.email ?? null,
        phone: data.phone ?? null,
        gender: data.gender ?? null,
        program_id: data.program_id ?? null,
        level_id: data.level_id ?? null,
        academic_year_id: data.academic_year_id ?? null,
        program: programName,
        faculty: facultyName,
        academic_level: levelName,
        academic_year: yearName,
        academic_status: data.academic_status ?? "مقيد — منتظم",
        cgpa: data.cgpa ?? null,
        earned_hours: data.earned_hours ?? null,
      })
      .eq("user_id", data.user_id)
      .select("*")
      .single();

    if (error || !updated) throw new Error(error?.message || "تعذر حفظ بيانات الطالب");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "update_student_profile",
      entityType: "student_profiles",
      entityId: data.user_id,
      metadata: { student_code: data.student_code },
    });

    return updated;
  });

export const adminSetStudentAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["active", "suspended", "pending", "rejected"]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin.rpc("admin_set_account_status_atomic", {
      _target_user_id: data.userId,
      _new_status: data.status,
      _actor_user_id: admin.userId,
      _actor_label: admin.actorLabel,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message || "تعذر تحديث حالة الحساب");

    return { ok: true as const };
  });

export const getAcademicCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    const [
      { data: programs, error: e1 },
      { data: levels, error: e2 },
      { data: years, error: e3 },
      { data: semesters, error: e4 },
      { data: courses, error: e5 },
      { data: offerings, error: e6 },
      { data: groups, error: e7 },
      { data: lectures, error: e8 },
    ] = await Promise.all([
      supabaseAdmin.from("academic_programs").select("*").order("name_ar"),
      supabaseAdmin.from("academic_levels").select("*").order("level_number"),
      supabaseAdmin.from("academic_years").select("*").order("name", { ascending: false }),
      supabaseAdmin.from("semesters").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("courses").select("*").order("code"),
      supabaseAdmin.from("course_offerings").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("academic_groups").select("*").order("name"),
      supabaseAdmin.from("lectures").select("*").order("day_of_week").order("start_time"),
    ]);

    if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8) {
      const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8;
      console.error("[admin] getAcademicCatalog query failed", { code: err?.code });
      throw new Error("تعذر تحميل الكتالوج الأكاديمي من قاعدة البيانات");
    }

    return {
      programs: programs ?? [],
      levels: levels ?? [],
      years: years ?? [],
      semesters: semesters ?? [],
      courses: courses ?? [],
      offerings: offerings ?? [],
      groups: groups ?? [],
      lectures: lectures ?? [],
    };
  });

export const adminUpsertProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(1).max(30),
        name_ar: z.string().trim().min(2).max(160),
        name_en: z.string().trim().max(160).optional(),
        faculty: z.string().trim().max(160).optional(),
        is_active: z.boolean().optional().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const payload = {
      code: data.code,
      name_ar: data.name_ar,
      name_en: data.name_en || null,
      faculty: data.faculty || null,
      is_active: data.is_active,
    };
    const res = data.id
      ? await supabaseAdmin
          .from("academic_programs")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("academic_programs").insert(payload).select("*").single();
    if (res.error || !res.data) throw new Error(res.error?.message || "تعذر حفظ البرنامج");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_program" : "create_program",
      entityType: "academic_programs",
      entityId: res.data.id,
      metadata: { code: res.data.code },
    });
    return res.data;
  });

export const adminUpsertLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        program_id: z.string().uuid(),
        level_number: z.number().int().min(0).max(10),
        name_ar: z.string().trim().min(2).max(120),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const payload = {
      program_id: data.program_id,
      level_number: data.level_number,
      name_ar: data.name_ar,
      sort_order: data.level_number,
    };
    const res = data.id
      ? await supabaseAdmin
          .from("academic_levels")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("academic_levels").insert(payload).select("*").single();
    if (res.error || !res.data) throw new Error(res.error?.message || "تعذر حفظ المستوى الأكاديمي");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_level" : "create_level",
      entityType: "academic_levels",
      entityId: res.data.id,
    });
    return res.data;
  });

export const adminUpsertAcademicYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(4).max(40),
        is_current: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { data: saved, error } = await supabaseAdmin.rpc("admin_upsert_academic_year_atomic", {
      _id: data.id ?? null,
      _name: data.name,
      _is_current: data.is_current,
      _actor_user_id: admin.userId,
      _actor_label: admin.actorLabel,
    });
    if (error || !saved) throw new Error(error?.message || "تعذر حفظ العام الأكاديمي");
    return saved;
  });

export const adminUpsertSemester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        academic_year_id: z.string().uuid(),
        season: z.enum(["FALL", "SPRING", "SUMMER"]),
        name_ar: z.string().trim().min(2).max(120),
        is_current: z.boolean().default(false),
        is_closed: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { data: saved, error } = await supabaseAdmin.rpc("admin_upsert_semester_atomic", {
      _id: data.id ?? null,
      _academic_year_id: data.academic_year_id,
      _season: data.season,
      _name_ar: data.name_ar,
      _is_current: data.is_current,
      _is_closed: data.is_closed,
      _actor_user_id: admin.userId,
      _actor_label: admin.actorLabel,
    });
    if (error || !saved) throw new Error(error?.message || "تعذر حفظ الفصل الدراسي");
    return saved;
  });

export const adminUpsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(2).max(30),
        name: z.string().trim().min(2).max(160),
        name_ar: z.string().trim().max(160).optional(),
        credit_hours: z.number().int().min(1).max(12),
        is_active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const payload = {
      code: data.code.toUpperCase(),
      name: data.name,
      name_ar: data.name_ar || null,
      credit_hours: data.credit_hours,
      is_active: data.is_active,
    };
    const res = data.id
      ? await supabaseAdmin.from("courses").update(payload).eq("id", data.id).select("*").single()
      : await supabaseAdmin.from("courses").insert(payload).select("*").single();
    if (res.error || !res.data) throw new Error(res.error?.message || "تعذر حفظ المقرر");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_course" : "create_course",
      entityType: "courses",
      entityId: res.data.id,
      metadata: { code: res.data.code },
    });
    return res.data;
  });

export const adminUpsertOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        course_id: z.string().uuid(),
        semester_id: z.string().uuid(),
        program_id: z.string().uuid().nullable().optional().default(null),
        level_id: z.string().uuid().nullable().optional().default(null),
        is_active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    await assertProgramLevelMatch(data.program_id, data.level_id);

    const payload = {
      course_id: data.course_id,
      semester_id: data.semester_id,
      program_id: data.program_id,
      level_id: data.level_id,
      is_active: data.is_active,
    };
    const res = data.id
      ? await supabaseAdmin
          .from("course_offerings")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("course_offerings").insert(payload).select("*").single();
    if (res.error || !res.data) throw new Error(res.error?.message || "تعذر حفظ طرح المقرر");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_offering" : "create_offering",
      entityType: "course_offerings",
      entityId: res.data.id,
    });
    return res.data;
  });

export const adminUpsertGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        offering_id: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        instructor: z.string().trim().max(160).optional(),
        capacity: z.number().int().positive().nullable().optional().default(null),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const payload = {
      offering_id: data.offering_id,
      name: data.name,
      instructor: data.instructor || null,
      capacity: data.capacity,
    };
    const res = data.id
      ? await supabaseAdmin
          .from("academic_groups")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("academic_groups").insert(payload).select("*").single();
    if (res.error || !res.data) throw new Error(res.error?.message || "تعذر حفظ المجموعة/السكشن");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_group" : "create_group",
      entityType: "academic_groups",
      entityId: res.data.id,
    });
    return res.data;
  });

export const adminEnrollStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        student_user_id: z.string().uuid(),
        offering_id: z.string().uuid(),
        group_id: z.string().uuid(),
        status: z.enum(["enrolled", "dropped", "completed"]).default("enrolled"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const [
      { data: grp, error: grpErr },
      { data: off, error: offErr },
      { data: stu, error: stuErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("academic_groups")
        .select("id, offering_id")
        .eq("id", data.group_id)
        .maybeSingle(),
      supabaseAdmin
        .from("course_offerings")
        .select("id, program_id, level_id")
        .eq("id", data.offering_id)
        .maybeSingle(),
      supabaseAdmin
        .from("student_profiles")
        .select("user_id, program_id, level_id")
        .eq("user_id", data.student_user_id)
        .maybeSingle(),
    ]);
    if (grpErr || offErr || stuErr) {
      throw new Error("تعذر التحقق من بيانات الطرح والمجموعة والطالب");
    }
    if (!grp || grp.offering_id !== data.offering_id) {
      throw new Error("المجموعة المحددة لا تتبع طرح المقرر المختار");
    }
    if (!off || !stu) {
      throw new Error("طرح المقرر أو ملف الطالب غير موجود");
    }
    if (data.status !== "dropped") {
      if (off.program_id && stu.program_id !== off.program_id) {
        throw new Error("البرنامج الأكاديمي للطالب لا يتوافق مع هذا الطرح");
      }
      if (off.level_id && stu.level_id !== off.level_id) {
        throw new Error("المستوى الأكاديمي للطالب لا يتوافق مع هذا الطرح");
      }
    }

    const { data: activeExisting, error: activeErr } = await supabaseAdmin
      .from("enrollments")
      .select("id, group_id, status")
      .eq("student_user_id", data.student_user_id)
      .eq("offering_id", data.offering_id)
      .in("status", ["enrolled", "completed"])
      .maybeSingle();

    if (activeErr) throw new Error("تعذر التحقق من تسجيلات الطالب السابقة");

    if (activeExisting) {
      if (activeExisting.group_id !== data.group_id) {
        throw new Error(
          "الطالب لديه تسجيل قائم بالفعل في مجموعة أخرى لهذا المقرر؛ قم بإسقاط التسجيل السابق أولًا للحفاظ على السجل التاريخي",
        );
      }
      if (activeExisting.status === data.status) {
        throw new Error("الطالب مسجل بالفعل في هذه المجموعة لنفس المقرر");
      }
    }

    const res = activeExisting
      ? await supabaseAdmin
          .from("enrollments")
          .update({ group_id: data.group_id, status: data.status })
          .eq("id", activeExisting.id)
          .select("*")
          .single()
      : await supabaseAdmin
          .from("enrollments")
          .insert({
            student_user_id: data.student_user_id,
            offering_id: data.offering_id,
            group_id: data.group_id,
            status: data.status,
          })
          .select("*")
          .single();

    if (res.error || !res.data)
      throw new Error(res.error?.message || "تعذر تسجيل الطالب في المجموعة");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "enroll_student",
      entityType: "enrollments",
      entityId: res.data.id,
      metadata: {
        student_user_id: data.student_user_id,
        group_id: data.group_id,
        status: res.data.status,
      },
    });
    return res.data;
  });

export const adminUpdateEnrollmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["enrolled", "dropped", "completed"]) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { data: updated, error } = await supabaseAdmin
      .from("enrollments")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error || !updated) throw new Error(error?.message || "تعذر تحديث حالة التسجيل");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: `update_enrollment_${data.status}`,
      entityType: "enrollments",
      entityId: updated.id,
    });
    return updated;
  });

export const adminRemoveEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin.from("enrollments").delete().eq("id", data.id);
    if (error) throw new Error("تعذر إلغاء التسجيل");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "remove_enrollment",
      entityType: "enrollments",
      entityId: data.id,
    });
    return { ok: true as const };
  });

export const adminUpsertLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        group_id: z.string().uuid(),
        day_of_week: z.enum(["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]),
        start_time: z.string().trim().min(4).max(8),
        end_time: z.string().trim().min(4).max(8),
        kind: z.enum(["lecture", "section", "lab"]),
        location: z.string().trim().min(1).max(120),
        instructor: z.string().trim().max(160).optional(),
      })
      .superRefine((v, ctx) => {
        try {
          const sNorm = normalizeTimeString(v.start_time);
          const eNorm = normalizeTimeString(v.end_time);
          if (parseTimeToMinutes(eNorm) <= parseTimeToMinutes(sNorm)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["end_time"],
              message: "وقت الانتهاء يجب أن يكون بعد وقت البدء في نفس اليوم",
            });
          }
        } catch (err) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["start_time"],
            message: err instanceof Error ? err.message : "صيغة الوقت غير صالحة",
          });
        }
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const startTime = normalizeTimeString(data.start_time);
    const endTime = normalizeTimeString(data.end_time);
    const startMins = parseTimeToMinutes(startTime);
    const endMins = parseTimeToMinutes(endTime);
    const startHour = Math.floor(startMins / 60);
    const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(endMins / 60)));

    const payload = {
      group_id: data.group_id,
      day_of_week: data.day_of_week,
      start_time: startTime,
      end_time: endTime,
      start_hour: startHour,
      end_hour: endHour,
      kind: data.kind,
      location: data.location,
      instructor: data.instructor || null,
    };
    const res = data.id
      ? await supabaseAdmin.from("lectures").update(payload).eq("id", data.id).select("*").single()
      : await supabaseAdmin.from("lectures").insert(payload).select("*").single();
    if (res.error || !res.data) throw new Error(res.error?.message || "تعذر حفظ المحاضرة");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_lecture" : "create_lecture",
      entityType: "lectures",
      entityId: res.data.id,
      metadata: { start_time: startTime, end_time: endTime },
    });
    return res.data;
  });

export const adminDeleteLecture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin.from("lectures").delete().eq("id", data.id);
    if (error) throw new Error("تعذر حذف المحاضرة");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "delete_lecture",
      entityType: "lectures",
      entityId: data.id,
    });
    return { ok: true as const };
  });

export const adminUpsertStudentGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        student_user_id: z.string().uuid(),
        semester_id: z.string().uuid(),
        course_id: z.string().uuid(),
        marks: z.number().min(0).max(100).nullable(),
        grade_letter: z.string().trim().max(6).nullable(),
        grade_points: z.number().min(0).max(4).nullable(),
        status_label: z.string().trim().min(1).max(40).default("ناجح"),
        is_published: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { data: saved, error } = await supabaseAdmin
      .from("student_grades")
      .upsert(
        {
          student_user_id: data.student_user_id,
          semester_id: data.semester_id,
          course_id: data.course_id,
          marks: data.marks,
          grade_letter: data.grade_letter,
          grade_points: data.grade_points,
          status_label: data.status_label,
          is_published: data.is_published,
        },
        { onConflict: "student_user_id,semester_id,course_id" },
      )
      .select("*")
      .single();

    if (error || !saved) throw new Error(error?.message || "تعذر حفظ الدرجة");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "upsert_student_grade",
      entityType: "student_grades",
      entityId: saved.id,
      metadata: { student_user_id: data.student_user_id, is_published: data.is_published },
    });

    return saved;
  });

export const adminDeleteStudentGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin.from("student_grades").delete().eq("id", data.id);
    if (error) throw new Error("تعذر حذف الدرجة");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "delete_student_grade",
      entityType: "student_grades",
      entityId: data.id,
    });
    return { ok: true as const };
  });

export const adminUpsertSemesterGradeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        student_user_id: z.string().uuid(),
        semester_id: z.string().uuid(),
        semester_gpa: z.number().min(0).max(4).nullable(),
        is_published: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { data: saved, error } = await supabaseAdmin
      .from("semester_grade_summaries")
      .upsert(
        {
          student_user_id: data.student_user_id,
          semester_id: data.semester_id,
          semester_gpa: data.semester_gpa,
          is_published: data.is_published,
        },
        { onConflict: "student_user_id,semester_id" },
      )
      .select("*")
      .single();

    if (error || !saved) throw new Error(error?.message || "تعذر حفظ ملخص المعدل الفصلي");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "upsert_semester_summary",
      entityType: "semester_grade_summaries",
      entityId: saved.id,
      metadata: {
        student_user_id: data.student_user_id,
        semester_id: data.semester_id,
        is_published: data.is_published,
      },
    });
    return saved;
  });

export const adminDeleteSemesterGradeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin
      .from("semester_grade_summaries")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("تعذر حذف ملخص الفصل الدراسي");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "delete_semester_summary",
      entityType: "semester_grade_summaries",
      entityId: data.id,
    });
    return { ok: true as const };
  });

export const listAdminCommunications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    const [{ data: announcements, error: e1 }, { data: events, error: e2 }] = await Promise.all([
      supabaseAdmin.from("announcements").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("academic_events").select("*").order("starts_at", { ascending: false }),
    ]);

    if (e1 || e2) throw new Error("تعذر تحميل الإعلانات والفعاليات");
    return { announcements: announcements ?? [], events: events ?? [] };
  });

export const adminUpsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(200),
        body: z.string().trim().min(2).max(4000),
        audience_scope: audienceSchema.default("all"),
        program_id: z.string().uuid().nullable().optional().default(null),
        level_id: z.string().uuid().nullable().optional().default(null),
        target_student_user_id: z.string().uuid().nullable().optional().default(null),
        is_published: z.boolean().default(false),
        is_archived: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    await assertProgramLevelMatch(data.program_id, data.level_id);

    const payload = {
      title: data.title,
      body: data.body,
      audience_scope: data.audience_scope,
      program_id: data.audience_scope === "program" ? data.program_id : null,
      level_id: data.audience_scope === "level" ? data.level_id : null,
      target_student_user_id:
        data.audience_scope === "student" ? data.target_student_user_id : null,
      is_published: data.is_published,
      is_archived: data.is_archived,
      published_at: data.is_published ? new Date().toISOString() : null,
      created_by: admin.userId,
    };
    const res = data.id
      ? await supabaseAdmin
          .from("announcements")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("announcements").insert(payload).select("*").single();
    if (res.error || !res.data) throw new Error(res.error?.message || "تعذر حفظ الإعلان");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_announcement" : "create_announcement",
      entityType: "announcements",
      entityId: res.data.id,
    });
    return res.data;
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error("تعذر حذف الإعلان");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "delete_announcement",
      entityType: "announcements",
      entityId: data.id,
    });
    return { ok: true as const };
  });

export const adminUpsertAcademicEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(200),
        description: z.string().trim().max(2000).optional(),
        event_type: z.enum(["exam", "deadline", "academic", "announcement"]).default("academic"),
        starts_at: z.string().min(4),
        ends_at: z.string().nullable().optional().default(null),
        location: z.string().trim().max(200).optional(),
        semester_id: z.string().uuid().nullable().optional().default(null),
        offering_id: z.string().uuid().nullable().optional().default(null),
        audience_scope: audienceSchema.default("all"),
        program_id: z.string().uuid().nullable().optional().default(null),
        level_id: z.string().uuid().nullable().optional().default(null),
        target_student_user_id: z.string().uuid().nullable().optional().default(null),
        is_published: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    await assertProgramLevelMatch(data.program_id, data.level_id);

    const payload = {
      title: data.title,
      description: data.description || null,
      event_type: data.event_type,
      starts_at: new Date(data.starts_at).toISOString(),
      ends_at: data.ends_at ? new Date(data.ends_at).toISOString() : null,
      location: data.location || null,
      semester_id: data.semester_id,
      offering_id: data.offering_id,
      audience_scope: data.audience_scope,
      program_id: data.audience_scope === "program" ? data.program_id : null,
      level_id: data.audience_scope === "level" ? data.level_id : null,
      target_student_user_id:
        data.audience_scope === "student" ? data.target_student_user_id : null,
      is_published: data.is_published,
      created_by: admin.userId,
    };
    const res = data.id
      ? await supabaseAdmin
          .from("academic_events")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("academic_events").insert(payload).select("*").single();
    if (res.error || !res.data) throw new Error(res.error?.message || "تعذر حفظ الفعالية");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: data.id ? "update_event" : "create_event",
      entityType: "academic_events",
      entityId: res.data.id,
    });
    return res.data;
  });

export const adminDeleteAcademicEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminActivity, requireAdminServer } = await import("./auth.server");
    const admin = await requireAdminServer(context.userId);

    const { error } = await supabaseAdmin.from("academic_events").delete().eq("id", data.id);
    if (error) throw new Error("تعذر حذف الفعالية");

    await logAdminActivity({
      actorUserId: admin.userId,
      actorLabel: admin.actorLabel,
      action: "delete_event",
      entityType: "academic_events",
      entityId: data.id,
    });
    return { ok: true as const };
  });

export const listAdminActivityLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(100).default(30),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const {
      data: logs,
      count,
      error,
    } = await supabaseAdmin
      .from("admin_activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error("تعذر تحميل سجل النشاط");
    return { items: logs ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });
