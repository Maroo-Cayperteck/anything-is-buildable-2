import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { getUserRolesServer, logAdminActivity } from "./auth.server";

export async function replaceStudentPassword(studentId: string, password: string) {
  const roles = await getUserRolesServer(studentId);
  if (!roles.includes("student") || roles.includes("admin")) {
    throw new Error("هذه الأداة لحسابات الطلاب فقط");
  }
  const { data: profile, error: profileError } = await db
    .from("student_profiles")
    .select("student_code")
    .eq("user_id", studentId)
    .maybeSingle();
  if (profileError || !profile?.student_code) throw new Error("ملف الطالب غير موجود");

  const { error } = await db.auth.admin.updateUserById(studentId, { password });
  if (error) throw new Error("تعذر تغيير كلمة المرور");
}

export async function resolvePasswordRequest(
  requestId: string,
  actorId: string,
  action: { outcome: "reset"; password: string } | { outcome: "dismissed" },
) {
  // Claim the request before calling Auth. A worker interrupted mid-request can be retried.
  const now = new Date();
  const lease = new Date(now.getTime() + 5 * 60_000).toISOString();
  const { data: entry, error } = await db
    .from("password_reset_requests")
    .update({ busy_until: lease })
    .eq("id", requestId)
    .is("handled_at", null)
    .or("busy_until.is.null,busy_until.lt." + now.toISOString())
    .select("student_user_id")
    .maybeSingle();
  if (error) throw new Error("تعذر فتح الطلب. حاول مرة أخرى.");
  if (!entry) throw new Error("الطلب اتعالج بالفعل أو قيد المعالجة. حدّث القائمة.");

  try {
    if (action.outcome === "reset")
      await replaceStudentPassword(entry.student_user_id, action.password);
  } catch (error) {
    await db
      .from("password_reset_requests")
      .update({ busy_until: null })
      .eq("id", requestId)
      .eq("busy_until", lease);
    throw error;
  }

  const finish = await db
    .from("password_reset_requests")
    .update({
      handled_at: new Date().toISOString(),
      handled_by: actorId,
      outcome: action.outcome,
      busy_until: null,
    })
    .eq("id", requestId)
    .eq("busy_until", lease)
    .select("id")
    .single();
  if (finish.error) {
    throw new Error(
      action.outcome === "reset"
        ? "كلمة المرور اتغيرت، لكن إغلاق الطلب تعذر. راجع الطلب قبل إعادة المحاولة."
        : "تعذر إغلاق الطلب. حاول مرة أخرى.",
    );
  }
  await logAdminActivity({
    actorUserId: actorId,
    action: action.outcome === "reset" ? "reset_student_password" : "dismiss_password_request",
    entityType: "password_reset_requests",
    entityId: requestId,
    metadata: { student_user_id: entry.student_user_id },
  });
}
