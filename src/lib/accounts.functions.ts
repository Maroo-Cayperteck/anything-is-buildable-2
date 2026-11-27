import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { looksLikeEmail, normalizeEmail, normalizeStudentCode } from "./auth-helpers";

function isSchemaCompatError(
  err: { code?: string | null; message?: string | null } | null,
  needle: string,
): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    (msg.includes(needle.toLowerCase()) &&
      (msg.includes("column") || msg.includes("relation") || msg.includes("table")))
  );
}

/**
 * Unauthenticated rate-limited sign-in helper for Student Code or Admin username identifiers.
 * Uses a service-role-only lookup RPC and authenticates with an ephemeral public client.
 * Requires the server-only Supabase secret for username/student-code lookup.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        identifier: z.string().trim().min(1, "يرجى إدخال اسم المستخدم أو الرقم الجامعي").max(160),
        password: z.string().min(1, "يرجى إدخال كلمة المرور").max(256),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { assertAuthRateLimit, createEphemeralPublishableClient, validateServerSupabaseConfig } =
      await import("./supabase-config.server");

    const { serviceRoleKey } = validateServerSupabaseConfig({ requireServiceRole: false });
    const cleanIdentifier = normalizeStudentCode(data.identifier);
    assertAuthRateLimit(`login:${cleanIdentifier.toLowerCase()}`);

    let resolvedEmail: string | null = looksLikeEmail(cleanIdentifier)
      ? normalizeEmail(cleanIdentifier)
      : null;

    if (!resolvedEmail) {
      if (!serviceRoleKey) {
        throw new Error("CONFIG_ERROR: إعدادات تسجيل الدخول على الخادم غير مكتملة.");
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // This RPC is restricted to service_role; never expose email lookup to browsers.
      const { data: email, error } = await supabaseAdmin.rpc("resolve_login_email", {
        p_identifier: cleanIdentifier.toLowerCase(),
      });
      if (error) {
        console.error("[auth] identifier lookup failed", { code: error.code });
        throw new Error("AUTH_LOOKUP_ERROR: تعذر التحقق من بيانات الحساب");
      }
      if (typeof email === "string" && email) resolvedEmail = normalizeEmail(email);
    }

    if (!resolvedEmail) {
      return { ok: false as const, reason: "invalid_credentials" as const };
    }

    // Never pass password to service_role client; use ephemeral publishable-key client
    const anonClient = createEphemeralPublishableClient();
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: resolvedEmail,
      password: data.password, // intentionally NOT trimmed
    });

    if (signInErr) {
      const msg = (signInErr.message ?? "").toLowerCase();
      if (msg.includes("email not confirmed") || signInErr.code === "email_not_confirmed") {
        return { ok: false as const, reason: "email_not_confirmed" as const };
      }
      if (signInErr.status === 429) {
        return { ok: false as const, reason: "rate_limited" as const };
      }
      if (signInErr.status && signInErr.status >= 500) {
        throw new Error("AUTH_SERVICE_UNAVAILABLE: تعذر الاتصال بخدمة المصادقة");
      }
      return { ok: false as const, reason: "invalid_credentials" as const };
    }

    if (!signInData.session?.access_token || !signInData.session?.refresh_token) {
      return { ok: false as const, reason: "invalid_credentials" as const };
    }

    return {
      ok: true as const,
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
    };
  });

// Student-code registration creates a confirmed internal Auth identity; approval remains mandatory.
export const registerWithStudentCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        studentCode: z
          .string()
          .transform(normalizeStudentCode)
          .pipe(
            z
              .string()
              .regex(/^9252500\d{2}$/, "الرقم الجامعي يجب أن يكون 9 أرقام ويبدأ بـ 9252500"),
          ),
        password: z.string().min(8).max(128),
        fullNameAr: z
          .string()
          .trim()
          .min(5)
          .max(160)
          .regex(/[\u0621-\u064A]/, "اكتب الاسم بالعربية"),
        level: z.number().int().min(0).max(3),
        term: z.number().int().min(1).max(2),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { assertAuthRateLimit } = await import("./supabase-config.server");
    assertAuthRateLimit("register-code:" + data.studentCode, 3, 3600_000);
    const [
      { data: profile, error: pe },
      { data: request, error: re },
      { data: roster, error: ro },
    ] = await Promise.all([
      db
        .from("student_profiles")
        .select("user_id")
        .eq("student_code", data.studentCode)
        .maybeSingle(),
      db.from("registration_requests").select("id").eq("student_code", data.studentCode).limit(1),
      db
        .from("student_roster")
        .select("is_active")
        .eq("student_code", data.studentCode)
        .maybeSingle(),
    ]);
    if (pe || re || ro) throw new Error("تعذر التحقق من الرقم الجامعي. حاول لاحقًا.");
    if (profile || request?.length)
      throw new Error("يوجد حساب أو طلب بهذا الرقم. سجّل الدخول أو راجع المسؤول.");
    if (roster && !roster.is_active) throw new Error("راجع المسؤول لتفعيل أهلية الرقم الجامعي.");
    const email = `student${data.studentCode}@hnu-portal.example.com`;
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user)
      throw new Error("تعذر إنشاء الحساب؛ قد يكون الرقم مسجلًا بالفعل. راجع المسؤول.");
    const { error: insertError } = await db
      .from("registration_requests")
      .insert({
        auth_user_id: created.user.id,
        student_code: data.studentCode,
        email,
        full_name_ar: data.fullNameAr,
        status: "pending",
        requested_level: data.level,
        requested_term: data.term,
        roster_verified: false,
      });
    if (insertError) {
      await db.auth.admin.deleteUser(created.user.id);
      throw new Error("تعذر حفظ الطلب. حاول مرة أخرى.");
    }
    return { ok: true };
  });

/**
 * Returns authoritative server-verified roles and student onboarding/account status
 * for the currently authenticated Supabase user using RLS-scoped queries.
 */
export const getAuthAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getUserRolesServer } = await import("./auth.server");

    const roles = await getUserRolesServer(context.userId, context.supabase);
    const [{ data: profile, error: profileErr }, { data: regRequest, error: regErr }] =
      await Promise.all([
        context.supabase
          .from("student_profiles")
          .select("user_id, account_status, full_name_ar, student_code")
          .eq("user_id", context.userId)
          .maybeSingle(),
        context.supabase
          .from("registration_requests")
          .select("status, rejection_reason")
          .eq("auth_user_id", context.userId)
          .maybeSingle(),
      ]);

    let accountStatus = profile?.account_status ?? null;
    if (profileErr) {
      if (isSchemaCompatError(profileErr, "account_status")) {
        const { data: legacyProfile, error: legacyErr } = await context.supabase
          .from("student_profiles")
          .select("user_id")
          .eq("user_id", context.userId)
          .maybeSingle();
        if (legacyErr) {
          console.error("[auth] legacy student_profiles lookup failed", { code: legacyErr.code });
          throw new Error("AUTH_STATUS_ERROR: تعذر قراءة ملف الطالب");
        }
        if (legacyProfile || roles.includes("student")) {
          accountStatus = "active";
        }
      } else {
        console.error("[auth] student_profiles status lookup failed", { code: profileErr.code });
        throw new Error("AUTH_STATUS_ERROR: تعذر التحقق من حالة حساب الطالب");
      }
    }

    if (regErr && !isSchemaCompatError(regErr, "registration_requests")) {
      console.error("[auth] registration_requests status lookup failed", { code: regErr.code });
      throw new Error("AUTH_STATUS_ERROR: تعذر التحقق من حالة طلب التسجيل");
    }

    return {
      userId: context.userId,
      roles,
      accountStatus,
      registrationStatus: regRequest?.status ?? null,
      rejectionReason: regRequest?.rejection_reason ?? null,
    };
  });

const registrationSchema = z.object({
  studentCode: z.string().trim().min(2, "يرجى إدخال الرقم الجامعي").max(40),
  email: z.string().trim().email("يرجى إدخال بريد إلكتروني صحيح").max(160),
  fullNameAr: z.string().trim().min(3, "يرجى إدخال الاسم الكامل بالعربية").max(160),
  fullNameEn: z.string().trim().max(160).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, "رقم الهاتف غير صالح")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["ذكر", "أنثى"]).optional(),
});

async function validateRegistrationCandidate(input: {
  studentCode: string;
  email: string;
  currentUserId?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalizedCode = normalizeStudentCode(input.studentCode);
  const normalizedEmail = normalizeEmail(input.email);

  // Reject duplicate active profile using this student code
  const { data: existingProfile, error: profErr } = await supabaseAdmin
    .from("student_profiles")
    .select("user_id")
    .eq("student_code", normalizedCode)
    .maybeSingle();
  if (profErr) {
    throw new Error("تعذر التحقق من عدم تكرار الرقم الجامعي");
  }
  if (existingProfile && existingProfile.user_id !== input.currentUserId) {
    throw new Error("يوجد حساب طالب مسجل بالفعل بهذا الرقم الجامعي");
  }

  // Reject duplicate pending/active registration requests
  const { data: existingByCode, error: reqCodeErr } = await supabaseAdmin
    .from("registration_requests")
    .select("id, auth_user_id, status")
    .eq("student_code", normalizedCode)
    .in("status", ["pending", "active"])
    .maybeSingle();
  if (reqCodeErr) {
    throw new Error("تعذر التحقق من طلبات التسجيل السابقة");
  }
  if (existingByCode && existingByCode.auth_user_id !== input.currentUserId) {
    throw new Error("يوجد طلب تسجيل قائم أو مقبول بالفعل لهذا الرقم الجامعي");
  }

  // Roster check (Execution Order Rule #5: validate if roster row exists; allow manual admin review if absent)
  const { data: rosterByCode, error: rosterErr } = await supabaseAdmin
    .from("student_roster")
    .select("*")
    .eq("student_code", normalizedCode)
    .maybeSingle();
  if (rosterErr) {
    throw new Error("تعذر التحقق من كشف الطلاب المؤهلين");
  }

  if (rosterByCode) {
    if (!rosterByCode.is_active) {
      throw new Error("تم إيقاف أهليّة هذا الرقم الجامعي في كشف الطلاب؛ يرجى مراجعة شؤون الطلاب");
    }
    if (normalizeEmail(rosterByCode.approved_email) !== normalizedEmail) {
      throw new Error(
        "البريد الإلكتروني المدخل لا يطابق البريد المسجل لهذا الرقم الجامعي في كشف المؤهلين",
      );
    }
    return {
      rosterId: rosterByCode.id,
      rosterVerified: true,
      fallbackNameEn: rosterByCode.full_name_en,
    };
  }

  // Ensure the email is not already bound to a different student_code in roster
  const { data: rosterByEmail, error: emailRosterErr } = await supabaseAdmin
    .from("student_roster")
    .select("student_code")
    .ilike("approved_email", normalizedEmail)
    .maybeSingle();
  if (emailRosterErr) {
    throw new Error("تعذر التحقق من البريد الإلكتروني في كشف المؤهلين");
  }
  if (rosterByEmail && rosterByEmail.student_code !== normalizedCode) {
    throw new Error("هذا البريد الإلكتروني مرتبط برقم جامعي آخر في كشف الطلاب");
  }

  return {
    rosterId: null as string | null,
    rosterVerified: false,
    fallbackNameEn: null as string | null,
  };
}

/**
 * Validates and persists a durable expiring registration intent BEFORE Supabase Auth signUp
 * so email confirmation flows never lose registration data or create dead ends.
 */
export const createRegistrationIntent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registrationSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertAuthRateLimit, validateServerSupabaseConfig } =
      await import("./supabase-config.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    validateServerSupabaseConfig({ requireServiceRole: true });
    const normalizedCode = normalizeStudentCode(data.studentCode);
    const normalizedEmail = normalizeEmail(data.email);
    assertAuthRateLimit(`register:${normalizedEmail}`, 8, 60_000);

    const candidate = await validateRegistrationCandidate({
      studentCode: normalizedCode,
      email: normalizedEmail,
    });

    const { data: existingReqByEmail } = await supabaseAdmin
      .from("registration_requests")
      .select("id, status")
      .ilike("email", normalizedEmail)
      .in("status", ["pending", "active"])
      .maybeSingle();
    if (existingReqByEmail) {
      throw new Error("يوجد طلب تسجيل قائم أو حساب نشط لهذا البريد الإلكتروني بالفعل");
    }

    const { data: intent, error: intentErr } = await supabaseAdmin
      .from("registration_intents")
      .insert({
        student_code: normalizedCode,
        email: normalizedEmail,
        full_name_ar: data.fullNameAr.trim(),
        full_name_en: data.fullNameEn?.trim() || candidate.fallbackNameEn || null,
        phone: data.phone?.trim() || null,
        gender: data.gender ?? null,
        roster_id: candidate.rosterId,
      })
      .select("id")
      .single();

    if (intentErr || !intent) {
      throw new Error("تعذر حفظ بيانات طلب التسجيل المبدئي");
    }

    return {
      intentId: intent.id,
      rosterVerified: candidate.rosterVerified,
    };
  });

/**
 * Creates a pending student registration request for an authenticated Supabase Auth user
 * (when email confirmation is disabled or after manual callback recovery).
 */
export const submitRegistrationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registrationSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalizedEmail = normalizeEmail(data.email);
    const normalizedCode = normalizeStudentCode(data.studentCode);
    const { data: userLookup, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userErr || !userLookup?.user?.email) {
      throw new Error("تعذر التحقق من حساب المصادقة");
    }
    if (normalizeEmail(userLookup.user.email) !== normalizedEmail) {
      throw new Error("البريد الإلكتروني المدخل لا يطابق بريد الحساب المسجل");
    }

    const { data: existingByUser, error: existingErr } = await supabaseAdmin
      .from("registration_requests")
      .select("id, status")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (existingErr) {
      throw new Error("تعذر التحقق من حالة الطلب الحالي");
    }
    if (existingByUser) {
      if (existingByUser.status === "pending") {
        return { ok: true as const, status: "pending" as const, alreadyExists: true };
      }
      if (existingByUser.status === "active") {
        return { ok: true as const, status: "active" as const, alreadyExists: true };
      }
      throw new Error("لا يمكن إعادة إرسال الطلب لهذا الحساب؛ يرجى مراجعة إدارة شؤون الطلاب");
    }

    const candidate = await validateRegistrationCandidate({
      studentCode: normalizedCode,
      email: normalizedEmail,
      currentUserId: context.userId,
    });

    const { error: insertErr } = await supabaseAdmin.from("registration_requests").insert({
      auth_user_id: context.userId,
      roster_id: candidate.rosterId,
      roster_verified: candidate.rosterVerified,
      student_code: normalizedCode,
      email: normalizedEmail,
      full_name_ar: data.fullNameAr.trim(),
      full_name_en: data.fullNameEn?.trim() || candidate.fallbackNameEn || null,
      phone: data.phone?.trim() || null,
      gender: data.gender ?? null,
      status: "pending",
    });

    if (insertErr) {
      throw new Error(insertErr.message || "تعذر تسجيل طلب الانضمام");
    }

    // Mark matching unconsumed intents for this email as consumed
    await supabaseAdmin
      .from("registration_intents")
      .update({
        consumed_at: new Date().toISOString(),
        consumed_by_user_id: context.userId,
      })
      .ilike("email", normalizedEmail)
      .is("consumed_at", null);

    return {
      ok: true as const,
      status: "pending" as const,
      rosterVerified: candidate.rosterVerified,
    };
  });

/**
 * Idempotent completion endpoint for /auth/callback after email confirmation.
 * Consumes the saved registration intent once and creates the pending admin review request.
 */
export const completeRegistrationCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userLookup, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userErr || !userLookup?.user?.email) {
      throw new Error("تعذر التحقق من حساب المستخدم المؤكد");
    }

    const authUser = userLookup.user;
    if (!authUser.email_confirmed_at) {
      throw new Error("لم يتم تأكيد البريد الإلكتروني بعد");
    }
    const verifiedEmail = normalizeEmail(authUser.email!);

    // 1. Idempotency check: existing registration request or student profile
    const { data: existingReq, error: reqLookupErr } = await supabaseAdmin
      .from("registration_requests")
      .select("id, status, student_code, roster_verified, rejection_reason")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (reqLookupErr) {
      throw new Error("تعذر التحقق من حالة طلب التسجيل");
    }
    if (existingReq) {
      return {
        outcome: "already_completed" as const,
        status: existingReq.status,
        studentCode: existingReq.student_code,
        rosterVerified: existingReq.roster_verified,
        rejectionReason: existingReq.rejection_reason,
      };
    }

    // 2. Find latest unconsumed & unexpired intent matching this verified email
    const nowIso = new Date().toISOString();
    const { data: intent, error: intentErr } = await supabaseAdmin
      .from("registration_intents")
      .select("*")
      .ilike("email", verifiedEmail)
      .is("consumed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intentErr) {
      throw new Error("تعذر استرجاع بيانات طلب التسجيل المحفوظة");
    }

    if (!intent) {
      return {
        outcome: "needs_intent" as const,
        email: verifiedEmail,
      };
    }

    const candidate = await validateRegistrationCandidate({
      studentCode: intent.student_code,
      email: verifiedEmail,
      currentUserId: context.userId,
    });

    const { data: consumedRow, error: consumeErr } = await supabaseAdmin
      .from("registration_intents")
      .update({
        consumed_at: nowIso,
        consumed_by_user_id: context.userId,
      })
      .eq("id", intent.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();

    if (consumeErr) {
      throw new Error("تعذر تأكيد استهلاك بيانات التسجيل");
    }
    if (!consumedRow) {
      // Another concurrent callback call may have created the request; verify idempotently
      const { data: concurrentReq } = await supabaseAdmin
        .from("registration_requests")
        .select("id, status, student_code, roster_verified, rejection_reason")
        .eq("auth_user_id", context.userId)
        .maybeSingle();
      if (concurrentReq) {
        return {
          outcome: "already_completed" as const,
          status: concurrentReq.status,
          studentCode: concurrentReq.student_code,
          rosterVerified: concurrentReq.roster_verified,
          rejectionReason: concurrentReq.rejection_reason,
        };
      }
      throw new Error("تعذر إتمام استكمال الطلب؛ يرجى إعادة المحاولة");
    }

    const { error: insertErr } = await supabaseAdmin.from("registration_requests").insert({
      auth_user_id: context.userId,
      roster_id: candidate.rosterId,
      roster_verified: candidate.rosterVerified,
      student_code: intent.student_code,
      email: verifiedEmail,
      full_name_ar: intent.full_name_ar,
      full_name_en: intent.full_name_en,
      phone: intent.phone,
      gender: intent.gender,
      status: "pending",
    });

    if (insertErr) {
      throw new Error(insertErr.message || "تعذر إنشاء طلب المراجعة بعد تأكيد البريد");
    }

    return {
      outcome: "completed_pending" as const,
      status: "pending" as const,
      studentCode: intent.student_code,
      rosterVerified: candidate.rosterVerified,
    };
  });

const contactSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/, "رقم الهاتف غير صالح")
    .nullable()
    .or(z.literal("")),
});

/**
 * Allows an active student to update ONLY their own permitted contact field (phone).
 * Official academic and identity columns cannot be modified by students.
 */
export const updateOwnContactInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { requireActiveStudentServer } = await import("./auth.server");

    await requireActiveStudentServer(context.userId, context.supabase);
    const cleanPhone = data.phone && data.phone.trim().length > 0 ? data.phone.trim() : null;

    const { data: updated, error } = await context.supabase
      .from("student_profiles")
      .update({ phone: cleanPhone })
      .eq("user_id", context.userId)
      .select("*")
      .single();

    if (error || !updated) {
      throw new Error("تعذر حفظ رقم الهاتف");
    }

    return updated;
  });
