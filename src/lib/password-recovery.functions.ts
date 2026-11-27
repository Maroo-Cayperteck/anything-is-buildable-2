import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeStudentCode } from "./auth-helpers";

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .max(24)
          .transform(normalizeStudentCode)
          .pipe(z.string().regex(/^\d{9}$/, "أدخل الرقم الجامعي المكوّن من تسعة أرقام")),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertAuthRateLimit } = await import("./supabase-config.server");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    assertAuthRateLimit("password-request:" + data.code, 5, 60_000);
    const { data: student, error } = await db
      .from("student_profiles")
      .select("user_id")
      .eq("student_code", data.code)
      .eq("account_status", "active")
      .maybeSingle();
    if (error) throw new Error("تعذر إرسال الطلب. حاول مرة أخرى.");
    if (student) {
      const { getUserRolesServer } = await import("./auth.server");
      const roles = await getUserRolesServer(student.user_id);
      if (roles.includes("student") && !roles.includes("admin")) {
        const { error: insertError } = await db
          .from("password_reset_requests")
          .insert({ student_user_id: student.user_id });
        if (insertError && insertError.code !== "23505")
          throw new Error("تعذر إرسال الطلب. حاول مرة أخرى.");
      }
    }
    // Same response for known, unknown, and already pending student numbers.
    return { ok: true };
  });

export const getPasswordResetRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data, error } = await db
      .from("password_reset_requests")
      .select("id,requested_at,busy_until,student_profiles(student_code,full_name_ar)")
      .is("handled_at", null)
      .order("requested_at")
      .order("id")
      .limit(100);
    if (error) throw new Error("تعذر تحميل طلبات كلمة المرور.");
    return data;
  });

export const handlePasswordResetRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .discriminatedUnion("outcome", [
        z.object({
          id: z.string().uuid(),
          outcome: z.literal("reset"),
          verifiedIdentity: z.literal(true),
          password: z
            .string()
            .min(8)
            .max(72)
            .refine(
              (password) =>
                new TextEncoder().encode(password).length <= 72 && password.trim().length >= 8,
              "اكتب كلمة مرور من 8 أحرف على الأقل، بحد أقصى 72 بايت",
            ),
        }),
        z.object({ id: z.string().uuid(), outcome: z.literal("dismissed") }),
      ])
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { requireAdminServer } = await import("./auth.server");
    await requireAdminServer(context.userId);
    const { resolvePasswordRequest } = await import("./password-recovery.server");
    await resolvePasswordRequest(data.id, context.userId, data);
    return { ok: true };
  });
