import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { alternateDistributions } from "@/lib/planning-preview";

function section(id: string, number: number, start: string, end: string): Tables<"schedule_slots"> {
  return {
    id,
    group_number: 2,
    section_number: number,
    lab_number: null,
    kind: "section",
    day_of_week: "Saturday",
    start_time: start,
    end_time: end,
    offering_id: "offer",
    location: "Room 1",
    instructor: null,
    is_deleted: false,
    version: 1,
    created_at: "",
    source: null,
  };
}
const target = {
  id: "original",
  day: "Saturday",
  startMinutes: 600,
  endMinutes: 720,
  kind: "section",
} as const;
const collision = { ...target, id: "lecture", kind: "lecture" } as const;
const item = { courseId: "course", group_number: 2, section_number: 1, lab_number: null };

describe("published alternatives for timetable conflicts", () => {
  it("suggests a matching distribution that resolves the overlap and skips another overlapping section", () => {
    const options = alternateDistributions(
      [
        section("original", 1, "10:00", "12:00"),
        section("still-conflicts", 2, "11:00", "13:00"),
        section("free", 3, "12:00", "14:00"),
      ],
      item,
      target,
      collision.id,
      [target],
      [collision],
    );
    expect(options.map((o) => [o.slot.id, o.choice.section_number])).toEqual([["free", 3]]);
  });

  it("does not propose a choice that drops a second meeting of the same course", () => {
    const options = alternateDistributions(
      [
        section("original", 1, "10:00", "12:00"),
        section("second-meeting", 1, "14:00", "16:00"),
        section("free", 3, "12:00", "14:00"),
      ],
      item,
      target,
      collision.id,
      [target, { ...target, id: "second-meeting", startMinutes: 840, endMinutes: 960 }],
      [collision],
    );
    expect(options).toEqual([]);
  });
});
