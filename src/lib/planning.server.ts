import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { readPlanItems, suggestedCodes, type PlanItem } from "./planning-utils";
import { findPlanningOffering } from "./planning-preview";
export async function persistPersonalPlan(
  userId: string,
  levelId: string,
  semesterId: string,
  items: PlanItem[],
) {
  const [{ data: level, error: le }, { data: sem, error: se }, { data: courses, error: ce }] =
    await Promise.all([
      db.from("academic_levels").select("*").eq("id", levelId).single(),
      db.from("semesters").select("*").eq("id", semesterId).eq("is_closed", false).single(),
      db
        .from("courses")
        .select("id")
        .eq("is_active", true)
        .in(
          "id",
          items.map((x) => x.courseId),
        ),
    ]);
  if (le || se || ce || !level || !sem || courses?.length !== items.length)
    throw new Error("راجع المستوى والفصل والمواد؛ قد يكون الفصل مغلقًا أو هناك مادة مكررة");
  const { data: offerings, error: oe } = await db
    .from("course_offerings")
    .select("*")
    .eq("semester_id", semesterId)
    .eq("program_id", level.program_id);
  if (oe) throw new Error("تعذر تحميل الطرح");
  const prepared: PlanItem[] = [];
  for (const item of items) {
    // Prefer the course's existing level so repeaters use its actual timetable.
    let off = findPlanningOffering(offerings, item, levelId);
    if (!off) {
      const created = await db
        .from("course_offerings")
        .insert({
          course_id: item.courseId,
          semester_id: semesterId,
          program_id: level.program_id,
          level_id: levelId,
        })
        .select("*")
        .single();
      if (created.error?.code === "23505") {
        const existing = await db
          .from("course_offerings")
          .select("*")
          .eq("course_id", item.courseId)
          .eq("semester_id", semesterId)
          .eq("program_id", level.program_id)
          .eq("level_id", levelId)
          .single();
        if (existing.error || !existing.data) throw new Error("تعذر تجهيز المادة");
        off = existing.data;
      } else {
        if (created.error || !created.data) throw new Error("تعذر تجهيز المادة");
        off = created.data;
      }
    }
    prepared.push({ ...item, offeringId: off.id });
  }
  const { error } = await db.from("personal_plans").upsert({
    student_user_id: userId,
    semester_id: semesterId,
    level_id: levelId,
    items: prepared,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("تعذر حفظ الخطة الشخصية");
  return prepared;
}
export async function initializeStudentPlan(
  userId: string,
  levelNumber: number,
  term: number,
  choice: { group_number: number | null; section_number: number | null; lab_number: number | null },
) {
  const { data: profile, error: pe } = await db
    .from("student_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (pe || !profile) throw new Error("تعذر تجهيز الحساب");
  const { data: years } = await db
    .from("academic_years")
    .select("id")
    .eq("is_current", true)
    .single();
  const { data: sem, error: se } = await db
    .from("semesters")
    .select("*")
    .eq("academic_year_id", years!.id)
    .eq("season", term === 1 ? "FALL" : "SPRING")
    .single();
  if (se || !sem) throw new Error("الفصل غير متاح");
  const { data: roster } = await db
    .from("planning_roster")
    .select("*")
    .eq("student_code", profile.student_code!)
    .eq("semester_id", sem.id)
    .maybeSingle();
  const { data: level, error: le } = roster
    ? await db.from("academic_levels").select("*").eq("id", roster.level_id).single()
    : await db
        .from("academic_levels")
        .select("*")
        .eq("program_id", profile.program_id!)
        .eq("level_number", levelNumber)
        .single();
  if (le || !level) throw new Error("المستوى غير متاح");
  const { data: courses, error: ce } = await db
    .from("courses")
    .select("id")
    .in("code", suggestedCodes(level.level_number, term));
  if (ce) throw new Error("تعذر اقتراح المواد");
  return persistPersonalPlan(
    userId,
    level.id,
    sem.id,
    (courses ?? []).map((x) => ({
      courseId: x.id,
      group_number: roster?.group_number ?? choice.group_number,
      section_number: roster?.section_number ?? choice.section_number,
      lab_number: roster?.lab_number ?? choice.lab_number,
    })),
  );
}
export { readPlanItems };
