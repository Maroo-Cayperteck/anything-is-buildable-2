import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getAuthAccountStatus, signInWithIdentifier } from "./accounts.functions";
import { looksLikeEmail, normalizeEmail, normalizeStudentCode } from "./auth-helpers";

export type Role = "student" | "admin";
type AccountStatus = Database["public"]["Enums"]["account_status"];

type ResolvedAccountStatus = {
  userId: string;
  roles: Role[];
  accountStatus: AccountStatus | null;
  registrationStatus: AccountStatus | null;
  rejectionReason: string | null;
};

function classifyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();

  if (lower.includes("config_error") || lower.includes("missing supabase environment variable")) {
    return "تعذر التحقق من الرقم الجامعي تلقائيًا. يرجى التأكد من تسجيل وتفعيل الحساب أولاً بالأسفل، أو الدخول بالبريد الإلكتروني.";
  }
  if (lower.includes("rate_limit") || lower.includes("too many requests")) {
    return "تم تجاوز عدد محاولات تسجيل الدخول المسموح بها؛ يرجى المحاولة بعد دقيقة.";
  }
  if (lower.includes("auth_status_error") || lower.includes("auth_lookup_error")) {
    return "تعذر التحقق من حالة وصلاحيات الحساب على الخادم، يرجى المحاولة لاحقًا.";
  }
  return "تعذر الاتصال بخدمة المصادقة، يرجى المحاولة لاحقًا.";
}

function isSchemaCompatFailure(
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

async function fetchStatusViaUserRls(userId: string): Promise<ResolvedAccountStatus> {
  const [
    { data: roleRows, error: roleErr },
    { data: profile, error: profErr },
    { data: regReq, error: regErr },
  ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("student_profiles")
      .select("user_id, account_status")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("registration_requests")
      .select("status, rejection_reason")
      .eq("auth_user_id", userId)
      .maybeSingle(),
  ]);

  if (roleErr) {
    throw new Error("AUTH_STATUS_ERROR: تعذر التحقق من صلاحيات الحساب");
  }

  const roles = (roleRows ?? []).map((r) => r.role as Role);
  let accountStatus: AccountStatus | null = profile?.account_status ?? null;

  if (profErr) {
    if (isSchemaCompatFailure(profErr, "account_status")) {
      const { data: legacyProfile, error: legacyErr } = await supabase
        .from("student_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (legacyErr) {
        throw new Error("AUTH_STATUS_ERROR: تعذر التحقق من ملف الطالب");
      }
      if (legacyProfile || roles.includes("student")) {
        accountStatus = "active";
      }
    } else {
      throw new Error("AUTH_STATUS_ERROR: تعذر التحقق من حالة حساب الطالب");
    }
  }

  if (regErr && !isSchemaCompatFailure(regErr, "registration_requests")) {
    throw new Error("AUTH_STATUS_ERROR: تعذر التحقق من حالة طلب التسجيل");
  }

  return {
    userId,
    roles,
    accountStatus,
    registrationStatus: (regReq?.status as AccountStatus | null) ?? null,
    rejectionReason: regReq?.rejection_reason ?? null,
  };
}

async function fetchStatusSafely(userId?: string): Promise<ResolvedAccountStatus> {
  try {
    return (await getAuthAccountStatus()) as ResolvedAccountStatus;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (
      userId &&
      !msg.includes("Unauthorized") &&
      !msg.includes("Forbidden") &&
      !msg.includes("AUTH_STATUS_ERROR")
    ) {
      return await fetchStatusViaUserRls(userId);
    }
    throw err;
  }
}

export async function portalSignIn(
  identifier: string,
  password: string,
): Promise<{ error: string | null; role: Role | null }> {
  const trimmedIdentifier = normalizeStudentCode(identifier);
  // IMPORTANT: Never trim or mutate password; leading/trailing spaces are valid password characters.
  const rawPassword = password;
  let signedInUserId: string | undefined;

  // Step 1: Authenticate via Supabase Auth (direct email or server-proxied student-code/username lookup)
  try {
    if (looksLikeEmail(trimmedIdentifier)) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(trimmedIdentifier),
        password: rawPassword,
      });

      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        if (msg.includes("email not confirmed") || error.code === "email_not_confirmed") {
          return {
            error:
              "يرجى تأكيد بريدك الإلكتروني عبر رابط التفعيل المرسل إلى بريدك قبل تسجيل الدخول.",
            role: null,
          };
        }
        if (error.status === 429) {
          return { error: "تم تجاوز عدد محاولات تسجيل الدخول؛ يرجى الانتظار قليلًا.", role: null };
        }
        if (
          error.name === "AuthRetryableFetchError" ||
          (error.status !== undefined && (error.status === 0 || error.status >= 500))
        ) {
          return { error: "تعذر الاتصال بخدمة المصادقة، يرجى المحاولة لاحقًا.", role: null };
        }
        return { error: "بيانات الدخول غير صحيحة", role: null };
      }

      if (!data.user || !data.session) {
        return { error: "بيانات الدخول غير صحيحة", role: null };
      }
      signedInUserId = data.user.id;
    } else {
      const proxyRes = await signInWithIdentifier({
        data: { identifier: trimmedIdentifier, password: rawPassword },
      });

      if (proxyRes) {
        if (!proxyRes.ok) {
          if (proxyRes.reason === "email_not_confirmed") {
            return {
              error:
                "يرجى تأكيد بريدك الإلكتروني عبر رابط التفعيل المرسل إلى بريدك قبل تسجيل الدخول.",
              role: null,
            };
          }
          if (proxyRes.reason === "rate_limited") {
            return { error: "تم تجاوز عدد محاولات تسجيل الدخول؛ يرجى الانتظار قليلًا.", role: null };
          }
          return {
            error:
              "بيانات الدخول غير صحيحة أو الحساب غير مسجل بعد. اضغط بالأسفل على (تفعيل / تسجيل حساب طالب جديد).",
            role: null,
          };
        }

        const { data: setData, error: setErr } = await supabase.auth.setSession({
          access_token: proxyRes.accessToken,
          refresh_token: proxyRes.refreshToken,
        });
        if (setErr) {
          return { error: "تعذر تثبيت جلسة المصادقة في المتصفح", role: null };
        }
        signedInUserId = setData.user?.id ?? setData.session?.user?.id;
      }
    }
  } catch (err) {
    return { error: classifyAuthError(err), role: null };
  }

  // Step 2: Verify server-authoritative roles and account/registration status
  try {
    const status = await fetchStatusSafely(signedInUserId);

    if (status.roles.includes("admin")) {
      return { error: null, role: "admin" };
    }

    if (status.roles.includes("student")) {
      if (status.accountStatus === "active") {
        return { error: null, role: "student" };
      }
      await supabase.auth.signOut().catch(() => {});
      if (status.accountStatus === "suspended") {
        return { error: "تم تعليق هذا الحساب من قِبل إدارة شؤون الطلاب", role: null };
      }
      if (status.accountStatus === "rejected") {
        return { error: "تم رفض طلب تفعيل هذا الحساب", role: null };
      }
      return { error: "حسابك قيد المراجعة من قِبل المسؤول", role: null };
    }

    await supabase.auth.signOut().catch(() => {});
    if (status.registrationStatus === "pending") {
      return { error: "طلب التسجيل الخاص بك قيد المراجعة حاليًا من قِبل المسؤول", role: null };
    }
    if (status.registrationStatus === "rejected") {
      return {
        error: status.rejectionReason
          ? `تم رفض طلب التسجيل: ${status.rejectionReason}`
          : "تم رفض طلب التسجيل الخاص بك",
        role: null,
      };
    }
    if (status.registrationStatus === "suspended") {
      return { error: "تم تعليق هذا الحساب من قِبل إدارة شؤون الطلاب", role: null };
    }

    return { error: "لا يملك هذا الحساب صلاحية الوصول للبوابة حاليًا", role: null };
  } catch (err) {
    await supabase.auth.signOut().catch(() => {});
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unauthorized") || msg.includes("Forbidden")) {
      return { error: "لا يملك هذا الحساب صلاحية الوصول للبوابة حاليًا", role: null };
    }
    return { error: "تعذر التحقق من حالة وصلاحيات الحساب، يرجى المحاولة لاحقًا.", role: null };
  }
}

export async function portalSignOut(): Promise<void> {
  await supabase.auth.signOut().catch(() => {});
}

export async function fetchRoles(): Promise<Role[]> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return [];
    const status = await fetchStatusSafely(data.user.id);
    if (status.roles.includes("admin")) return ["admin"];
    if (status.roles.includes("student") && status.accountStatus === "active") return ["student"];
    return [];
  } catch {
    return [];
  }
}

/**
 * Authoritative Supabase session + server-verified role & account status gate.
 * Never falls back to cookies or localStorage when Supabase Auth fails.
 */
export function useRoleGate(required: Role) {
  const [state, setState] = useState<{
    status: "loading" | "ok" | "denied";
    session: Session | null;
  }>({
    status: "loading",
    session: null,
  });

  useEffect(() => {
    let active = true;

    const verifyAuth = async (sbSession: Session | null) => {
      if (!sbSession) {
        if (active) setState({ status: "denied", session: null });
        return;
      }

      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes.user) {
          if (active) setState({ status: "denied", session: null });
          return;
        }

        const status = await fetchStatusSafely(userRes.user.id);
        const isAuthorized =
          required === "admin"
            ? status.roles.includes("admin")
            : status.roles.includes("student") && status.accountStatus === "active";

        if (!isAuthorized) {
          if (active) setState({ status: "denied", session: null });
          return;
        }

        if (active) setState({ status: "ok", session: sbSession });
      } catch {
        if (active) setState({ status: "denied", session: null });
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => verifyAuth(data.session))
      .catch(() => verifyAuth(null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (active) setState({ status: "denied", session: null });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // Supabase invokes this callback while holding its auth lock.
        // Defer requests that call getUser/getSession until the callback returns.
        window.setTimeout(() => { if (active) void verifyAuth(session); }, 0);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [required]);

  return state;
}
