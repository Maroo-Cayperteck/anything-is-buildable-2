import type { PlanItem } from "./planning-utils";
import { matchesChoice, overlappingSlots, type ScheduleChoice } from "./schedule-utils";
import { parseTimeToMinutes } from "./auth-helpers";
import type { Tables } from "@/integrations/supabase/types";

type Slot = Tables<"schedule_slots">;
type Offering = Pick<Tables<"course_offerings">, "id" | "course_id" | "level_id">;
type Meeting = {
  id: string;
  day: string;
  startMinutes: number;
  endMinutes: number;
  kind: Slot["kind"];
};
type DistributionKey = keyof ScheduleChoice;
const keys = ["group_number", "section_number", "lab_number"] as const;

export function findPlanningOffering<T extends Offering>(
  offerings: T[],
  item: PlanItem,
  levelId: string,
) {
  return (
    offerings.find((o) => o.course_id === item.courseId && o.level_id === levelId) ??
    offerings.find((o) => o.course_id === item.courseId)
  );
}

export function fullChoice(item: PlanItem): ScheduleChoice {
  return {
    group_number: item.group_number ?? null,
    section_number: item.section_number ?? null,
    lab_number: item.lab_number ?? null,
  };
}

export function alternateDistributions(
  slots: Slot[],
  item: PlanItem,
  target: Meeting,
  conflictingId: string,
  currentCourse: Meeting[],
  otherMeetings: Meeting[],
) {
  const choice = fullChoice(item);
  const previousPairs = overlappingSlots([...currentCourse, ...otherMeetings]);
  const pairKey = (pair: string[]) => [...pair].sort().join(":");
  const existing = new Set(previousPairs.map(pairKey));
  const originalConflict = pairKey([target.id, conflictingId]);
  if (!existing.has(originalConflict)) return [];
  const found = new Set<string>();
  const options: { choice: ScheduleChoice; slot: Slot; changed: DistributionKey[] }[] = [];

  for (const slot of slots) {
    if (slot.id === target.id || slot.kind !== target.kind) continue;
    const next = { ...choice };
    const changed = keys.filter((key) => slot[key] !== null && slot[key] !== choice[key]);
    for (const key of changed) next[key] = slot[key];
    const key = keys.map((field) => next[field]).join(":");
    if (!changed.length || found.has(key)) continue;

    const meetings = slots
      .filter((s) => matchesChoice(s, next))
      .map(
        (s): Meeting =>
          currentCourse.find((m) => m.id === s.id) ?? {
            id: s.id,
            kind: s.kind,
            day: s.day_of_week,
            startMinutes: parseTimeToMinutes(s.start_time),
            endMinutes: parseTimeToMinutes(s.end_time),
          },
      );
    // Do not resolve a collision by dropping another meeting from this course.
    if (
      currentCourse.some(
        ({ kind }) =>
          meetings.filter((m) => m.kind === kind).length <
          currentCourse.filter((m) => m.kind === kind).length,
      )
    )
      continue;
    const pairs = overlappingSlots([...meetings, ...otherMeetings]).map(pairKey);
    if (pairs.includes(originalConflict) || pairs.some((pair) => !existing.has(pair))) continue;
    found.add(key);
    options.push({ choice: next, slot, changed });
  }

  return options.sort((a, b) => a.changed.length - b.changed.length);
}
