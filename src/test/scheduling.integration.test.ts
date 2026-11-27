// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
// Exercise real handlers and PostgreSQL RLS; only TanStack transport is replaced.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (d: unknown) => unknown = (d) => d;
    const b = {
      middleware: () => b,
      inputValidator: (v: typeof validate) => {
        validate = v;
        return b;
      },
      handler:
        (fn: (a: unknown) => unknown) =>
        (args: { data?: unknown; context?: unknown } = {}) =>
          fn({ ...args, data: validate(args.data) }),
    };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
describe.skipIf(process.env["RUN_PORTAL_INTEGRATION"] !== "1")(
  "Live registration and schedule lifecycle",
  () => {
    it("requires approval, assigns courses, isolates students, saves personal schedules and handles requests", async () => {
      for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
        const i = line.indexOf("=");
        if (i > 0) process.env[line.slice(0, i)] = line.slice(i + 1).replace(/^['"]|['"]$/g, "");
      }
      const url = process.env["SUPABASE_URL"]!,
        key = process.env["SUPABASE_PUBLISHABLE_KEY"]!,
        secret = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
      const db = createClient(url, secret, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
        client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      const { registerWithStudentCode, signInWithIdentifier } =
        await import("@/lib/accounts.functions");
      const { adminApproveRegistration } = await import("@/lib/admin.functions");
      const {
        applyStudentPlan,
        sendScheduleRequest,
        saveScheduleOverride,
        respondScheduleRequest,
      } = await import("@/lib/scheduling.functions");
      const { getStudentPortalSnapshot } = await import("@/lib/portal.functions");
      const call = async (fn: unknown, data: unknown, context?: unknown) =>
        (fn as (x: unknown) => Promise<any>)({ data, context });
      const code = "925250098",
        password = randomUUID() + "aA1!",
        name = "اختبار مؤقت للتسجيل والجداول";
      const existing = await db.from("registration_requests").select("id").eq("student_code", code);
      expect(existing.data).toHaveLength(0);
      let uid: string | undefined;
      try {
        await call(registerWithStudentCode, {
          studentCode: code,
          password,
          fullNameAr: name,
          level: 1,
          term: 1,
        });
        const req = await db
          .from("registration_requests")
          .select("*")
          .eq("student_code", code)
          .single();
        expect(req.error).toBeNull();
        uid = req.data!.auth_user_id;
        expect(req.data!.status).toBe("pending");
        const login = await call(signInWithIdentifier, { identifier: code, password });
        expect(login.ok).toBe(true);
        await client.auth.setSession({
          access_token: login.accessToken,
          refresh_token: login.refreshToken,
        });
        const student = { userId: uid, supabase: client };
        await expect(call(getStudentPortalSnapshot, {}, student)).rejects.toThrow("Forbidden");
        const adminRow = await db
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1)
          .single();
        const admin = { userId: adminRow.data!.user_id, supabase: db };
        const level = await db.from("academic_levels").select("*").eq("level_number", 1).single(),
          sem = await db.from("semesters").select("*").eq("is_current", true).single();
        await call(
          adminApproveRegistration,
          {
            requestId: req.data!.id,
            programId: level.data!.program_id,
            levelId: level.data!.id,
            academicYearId: sem.data!.academic_year_id,
          },
          admin,
        );
        const courses = await db
          .from("courses")
          .select("id")
          .in("code", ["GEN211", "ECE211", "ECE221", "CSE221", "CSE222", "ECE281", "GEN254"]);
        const plan = {
          studentId: uid,
          levelId: level.data!.id,
          semesterId: sem.data!.id,
          courseIds: courses.data!.map((x) => x.id),
          group: 2,
          section: 3,
          lab: 3,
        };
        await expect(call(applyStudentPlan, plan, student)).rejects.toThrow("Forbidden");
        await call(applyStudentPlan, plan, admin);
        const snap = await call(getStudentPortalSnapshot, {}, student);
        expect(snap.enrollments).toHaveLength(7);
        expect(snap.timetable).toHaveLength(12);
        expect(
          snap.timetable.find((x: any) => x.courseCode === "GEN211" && x.kind === "lecture")
            .startTime,
        ).toBe("10:00");
        const own = await client.from("student_profiles").select("user_id");
        expect(own.data?.every((x) => x.user_id === uid)).toBe(true);
        const slot = snap.timetable[0];
        await call(
          saveScheduleOverride,
          {
            slotId: slot.id,
            reset: false,
            day_of_week: "Thursday",
            start_time: "09:15",
            end_time: "10:45",
            location: "قاعة اختبار",
          },
          student,
        );
        const changed = await call(getStudentPortalSnapshot, {}, student);
        expect(changed.timetable.find((x: any) => x.id === slot.id).startTime).toBe("09:15");
        const other = await db
          .from("student_profiles")
          .select("user_id")
          .eq("student_code", "925250059")
          .single();
        const otherOverrides = await client
          .from("schedule_overrides")
          .select("*")
          .eq("student_user_id", other.data!.user_id);
        expect(otherOverrides.data).toEqual([]);
        await call(sendScheduleRequest, { message: "طلب تجريبي لتعديل السيكشن" }, student);
        const requests = await db
          .from("schedule_requests")
          .select("*")
          .eq("student_user_id", uid)
          .single();
        await call(
          respondScheduleRequest,
          { id: requests.data!.id, status: "resolved", reply: "تمت مراجعة طلب الاختبار" },
          admin,
        );
        const visible = await client
          .from("schedule_requests")
          .select("*")
          .eq("id", requests.data!.id)
          .single();
        expect(visible.data!.status).toBe("resolved");
        const forbidden = await client
          .from("schedule_slots")
          .update({ location: "bad" })
          .eq("id", slot.id);
        const protectedSlot = await db
          .from("schedule_slots")
          .select("location")
          .eq("id", slot.id)
          .single();
        expect(protectedSlot.data!.location).not.toBe("bad");
        await expect(
          call(registerWithStudentCode, {
            studentCode: code,
            password,
            fullNameAr: name,
            level: 1,
            term: 1,
          }),
        ).rejects.toThrow();
      } finally {
        if (uid) {
          await client.auth.signOut();
          const verify = await db.auth.admin.getUserById(uid);
          if (verify.data.user?.email === `student${code}@hnu-portal.example.com`) {
            const r = await db.auth.admin.deleteUser(uid);
            expect(r.error).toBeNull();
          }
        }
      }
    }, 120000);
  },
);
