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
    it("opens accounts immediately, separates personal plans, isolates records, and verifies schedule operations", async () => {
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
      const {
        saveMyPlan,
        getPlanningCatalog,
        importPlanningRoster,
        applyRosterPlan,
        savePersonalEvent,
        saveScheduleException,
        undoScheduleChange,
        getScheduleImpact,
      } = await import("@/lib/planning.functions");
      const {
        applyStudentPlan,
        sendScheduleRequest,
        saveScheduleOverride,
        respondScheduleRequest,
        saveScheduleSlot,
        deleteScheduleSlot,
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
      let fixtureCourse: string | undefined,
        fixtureOffering: string | undefined,
        fixtureSlot: string | undefined,
        testSemester: string | undefined;
      try {
        await call(registerWithStudentCode, {
          studentCode: code,
          password,
          fullNameAr: name,
          level: 1,
          term: 1,
          group: 2,
          section: 3,
          lab: 3,
        });
        const req = await db
          .from("registration_requests")
          .select("*")
          .eq("student_code", code)
          .single();
        expect(req.error).toBeNull();
        uid = req.data!.auth_user_id;
        expect(req.data!.status).toBe("active");
        const login = await call(signInWithIdentifier, { identifier: code, password });
        expect(login.ok).toBe(true);
        await client.auth.setSession({
          access_token: login.accessToken,
          refresh_token: login.refreshToken,
        });
        const student = { userId: uid, supabase: client };
        const opened = await call(getStudentPortalSnapshot, {}, student);
        expect(opened.profile.cgpa).toBeNull();
        expect(opened.profile.earned_hours).toBeNull();
        expect(opened.profile.academic_status).toBe("في الانتظار");
        expect(opened.grades).toEqual([]);
        expect(opened.enrollments).toHaveLength(7);
        expect(opened.timetable).toHaveLength(12);
        const publicCatalog = await call(getPlanningCatalog, {}, student);
        expect(publicCatalog.slots.length).toBeGreaterThan(12);
        expect((await client.from("student_documents").select("*")).data).toEqual([]);
        expect(
          (await client.from("personal_plans").select("*")).data?.every(
            (x) => x.student_user_id === uid,
          ),
        ).toBe(true);
        const directProfile = await client
          .from("student_profiles")
          .update({ cgpa: 4 })
          .eq("user_id", uid!);
        expect(
          (await db.from("student_profiles").select("cgpa").eq("user_id", uid!).single()).data!
            .cgpa,
        ).toBeNull();

        const adminRow = await db
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1)
          .single();
        const admin = { userId: adminRow.data!.user_id, supabase: db };
        const { requestPasswordReset, getPasswordResetRequests, handlePasswordResetRequest } =
          await import("@/lib/password-recovery.functions");
        const recovery = await Promise.all([
          call(requestPasswordReset, { code }),
          call(requestPasswordReset, { code }),
          call(requestPasswordReset, { code: "000000000" }),
        ]);
        expect(recovery).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
        expect((await client.from("password_reset_requests").select("id")).error).not.toBeNull();
        await expect(call(getPasswordResetRequests, undefined, student)).rejects.toThrow(
          "Forbidden",
        );
        const pending = await db
          .from("password_reset_requests")
          .select("id")
          .eq("student_user_id", uid!);
        expect(pending.error).toBeNull();
        expect(pending.data).toHaveLength(1);
        const resetId = pending.data![0]!.id;
        const passwordResetInput = {
          id: resetId,
          outcome: "reset",
          verifiedIdentity: true,
          password: randomUUID() + "Aa1!",
        };
        await expect(
          call(
            handlePasswordResetRequest,
            { ...passwordResetInput, verifiedIdentity: false },
            admin,
          ),
        ).rejects.toThrow();
        expect(
          (await call(getPasswordResetRequests, undefined, admin)).some(
            (row: { id: string }) => row.id === resetId,
          ),
        ).toBe(true);
        await expect(call(handlePasswordResetRequest, passwordResetInput, student)).rejects.toThrow(
          "Forbidden",
        );
        const attempts = await Promise.allSettled([
          call(handlePasswordResetRequest, passwordResetInput, admin),
          call(handlePasswordResetRequest, passwordResetInput, admin),
        ]);
        expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const freshLogin = await call(signInWithIdentifier, {
          identifier: code,
          password: passwordResetInput.password,
        });
        expect(freshLogin.ok).toBe(true);
        expect(
          (
            await client.auth.setSession({
              access_token: freshLogin.accessToken,
              refresh_token: freshLogin.refreshToken,
            })
          ).error,
        ).toBeNull();
        const oldLogin = await call(signInWithIdentifier, { identifier: code, password });
        expect(oldLogin.ok).toBe(false);
        expect(
          (await db.from("password_reset_requests").select("outcome").eq("id", resetId).single())
            .data?.outcome,
        ).toBe("reset");

        const level = await db.from("academic_levels").select("*").eq("level_number", 1).single(),
          sem = await db.from("semesters").select("*").eq("is_current", true).single();
        testSemester = sem.data!.id;
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
        // The student can freely customize their plan without writing official enrollments.
        await call(
          saveMyPlan,
          {
            levelId: plan.levelId,
            semesterId: plan.semesterId,
            items: plan.courseIds.map((courseId) => ({
              courseId,
              group_number: 2,
              section_number: 3,
              lab_number: 3,
            })),
          },
          student,
        );
        expect(
          (await db.from("enrollments").select("id").eq("student_user_id", uid!)).data,
        ).toHaveLength(0);

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
        expect(changed.baseTimetable.find((x: any) => x.id === slot.id).startTime).toBe(
          slot.startTime,
        );
        await call(
          saveScheduleOverride,
          {
            slotId: slot.id,
            reset: true,
            day_of_week: slot.day,
            start_time: slot.startTime,
            end_time: slot.endTime,
            location: slot.room,
          },
          student,
        );
        const reset = await call(getStudentPortalSnapshot, {}, student);
        expect(reset.timetable.find((x: any) => x.id === slot.id).isPersonal).toBe(false);
        await call(
          importPlanningRoster,
          {
            text: `student_code,level,group,section,lab\n${code},1,1,1,1`,
            semesterId: plan.semesterId,
          },
          admin,
        );
        await expect(
          call(
            importPlanningRoster,
            {
              text: `student_code,level,group,section,lab\n${code},1,1,1,1`,
              semesterId: plan.semesterId,
            },
            student,
          ),
        ).rejects.toThrow("Forbidden");
        expect((await call(applyRosterPlan, { semesterId: plan.semesterId }, student))[0].ok).toBe(
          true,
        );
        const fromRoster = await call(getStudentPortalSnapshot, {}, student);
        expect(
          fromRoster.timetable.find((x: any) => x.courseCode === "GEN211" && x.kind === "lecture")
            .startTime,
        ).toBe("08:00");
        await call(
          savePersonalEvent,
          {
            title: "مذاكرة اختبار",
            event_date: "2035-01-06",
            start_time: "15:00",
            end_time: "16:00",
            note: "خاص",
          },
          student,
        );
        expect((await call(getStudentPortalSnapshot, {}, student)).personalEvents).toHaveLength(1);
        // Disposable standalone course keeps schedule mutation tests away from real student plans.
        const fc = await db
          .from("courses")
          .insert({
            code: "TEST-" + randomUUID().slice(0, 8),
            name: "Temporary integration fixture",
            credit_hours: 1,
          })
          .select("id")
          .single();
        expect(fc.error).toBeNull();
        fixtureCourse = fc.data!.id;
        const fo = await db
          .from("course_offerings")
          .insert({
            course_id: fixtureCourse,
            semester_id: plan.semesterId,
            program_id: level.data!.program_id,
            level_id: plan.levelId,
          })
          .select("id")
          .single();
        expect(fo.error).toBeNull();
        fixtureOffering = fo.data!.id;
        await call(
          saveScheduleSlot,
          {
            offering_id: fixtureOffering,
            kind: "lecture",
            day_of_week: "Saturday",
            start_time: "08:00",
            end_time: "09:00",
            location: "Fixture",
            instructor: null,
            group_number: null,
            section_number: null,
            lab_number: null,
          },
          admin,
        );
        const fs = await db
          .from("schedule_slots")
          .select("*")
          .eq("offering_id", fixtureOffering)
          .single();
        fixtureSlot = fs.data!.id;
        const impact = await call(getScheduleImpact, { slotId: fixtureSlot }, admin);
        expect(impact.count).toBe(0);
        const payload = {
          id: fixtureSlot,
          expectedVersion: impact.version,
          offering_id: fixtureOffering,
          kind: "lecture",
          day_of_week: "Saturday",
          start_time: "09:00",
          end_time: "10:00",
          location: "Updated fixture",
          instructor: null,
          group_number: null,
          section_number: null,
          lab_number: null,
        };
        await expect(call(saveScheduleSlot, payload, student)).rejects.toThrow("Forbidden");
        await call(saveScheduleSlot, payload, admin);
        await expect(call(saveScheduleSlot, payload, admin)).rejects.toThrow();
        const history = await db
          .from("schedule_history")
          .select("id")
          .eq("slot_id", fixtureSlot)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        await call(undoScheduleChange, { historyId: history.data!.id }, admin);
        expect(
          (await db.from("schedule_slots").select("location").eq("id", fixtureSlot).single()).data!
            .location,
        ).toBe("Fixture");
        await call(
          saveScheduleException,
          {
            slotId: fixtureSlot,
            occurrenceDate: "2035-01-06",
            cancelled: true,
            note: "Test cancellation",
          },
          admin,
        );
        await expect(
          call(
            saveScheduleException,
            { slotId: fixtureSlot, occurrenceDate: "2035-01-06", cancelled: true, note: "" },
            student,
          ),
        ).rejects.toThrow("Forbidden");
        expect(
          (await client.from("schedule_exceptions").select("*").eq("slot_id", fixtureSlot)).data,
        ).toHaveLength(1);
        await call(
          saveScheduleException,
          {
            slotId: fixtureSlot,
            occurrenceDate: "2035-01-06",
            cancelled: false,
            replacementDate: "2035-01-07",
            start: "11:00",
            end: "12:00",
            room: "C",
            note: "Test makeup",
          },
          admin,
        );
        expect(
          (
            await db
              .from("schedule_exceptions")
              .select("replacement_date")
              .eq("slot_id", fixtureSlot)
              .single()
          ).data!.replacement_date,
        ).toBe("2035-01-07");
        await call(deleteScheduleSlot, { id: fixtureSlot }, admin);
        expect(
          (await call(getPlanningCatalog, {}, student)).slots.some(
            (x: any) => x.id === fixtureSlot,
          ),
        ).toBe(false);

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
        if (fixtureSlot) {
          await db.from("schedule_history").delete().eq("slot_id", fixtureSlot);
          await db.from("schedule_slots").delete().eq("id", fixtureSlot);
        }
        if (fixtureOffering) await db.from("course_offerings").delete().eq("id", fixtureOffering);
        if (fixtureCourse) await db.from("courses").delete().eq("id", fixtureCourse);
        if (testSemester)
          await db
            .from("planning_roster")
            .delete()
            .eq("student_code", code)
            .eq("semester_id", testSemester);
        if (uid) {
          await client.auth.signOut();
          const verify = await db.auth.admin.getUserById(uid);
          if (verify.data.user?.email === `student${code}@hnu-portal.example.com`) {
            const r = await db.auth.admin.deleteUser(uid);
            expect(r.error).toBeNull();
          }
        }
      }
    }, 180000);
  },
);
