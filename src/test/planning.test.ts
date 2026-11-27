import { describe, it, expect } from "vitest";
import {
  parseRoster,
  daySchedule,
  cairoClock,
  validDate,
  validTime,
  suggestedCodes,
} from "@/lib/planning-utils";
describe("planning input and real daily schedule", () => {
  it("reads Excel CSV and Arabic digits and flags duplicates", () => {
    const rows = parseRoster(
      "\uFEFFstudent_code,level,group,section,lab\n٩٢٥٢٥٠٠٥٠,1,2,3,3\n925250050,1,1,1,1",
    );
    expect(rows[0]?.student_code).toBe("925250050");
    expect(rows[0]?.errors).toEqual([]);
    expect(rows[1]?.errors).toContain("رقم مكرر");
  });
  it("reads pasted worksheet tabs and blank unknown choices", () => {
    expect(
      parseRoster("student_code\tlevel\tgroup\tsection\tlab\n925250051\t0\t\t\t")[0],
    ).toMatchObject({ level: 0, group_number: null, errors: [] });
  });
  it("rejects invalid level, fractional groups, malformed codes and headers", () => {
    expect(
      parseRoster("student_code,level,group,section,lab\n12,9,1.5,0,33")[0]?.errors,
    ).toHaveLength(5);
    expect(() => parseRoster("foo,bar\n1,2")).toThrow();
  });
  it("validates actual dates and times", () => {
    expect(validDate.safeParse("2026-02-30").success).toBe(false);
    expect(validDate.safeParse("2028-02-29").success).toBe(true);
    expect(validTime.safeParse("25:71").success).toBe(false);
  });
  const slot = {
    id: "slot",
    day: "Saturday",
    startTime: "08:00",
    endTime: "10:00",
    startMinutes: 480,
    endMinutes: 600,
    room: "A",
    course: "Math",
    courseCode: "GEN211",
    kind: "lecture",
  };
  it("cancels only the specified occurrence and preserves the following week", () => {
    const c = {
      slot_id: "slot",
      occurrence_date: "2026-11-28",
      cancelled: true,
      replacement_date: null,
      start_time: null,
      end_time: null,
      location: null,
      note: "",
    };
    expect(daySchedule([slot], [c], "2026-11-28")).toHaveLength(0);
    expect(daySchedule([slot], [c], "2026-12-05")).toHaveLength(1);
  });
  it("moves one occurrence across days without leaving the original", () => {
    const c = {
      slot_id: "slot",
      occurrence_date: "2026-11-28",
      cancelled: false,
      replacement_date: "2026-11-29",
      start_time: "11:30",
      end_time: "12:30",
      location: "B",
      note: "تعويض",
    };
    expect(daySchedule([slot], [c], "2026-11-28")).toHaveLength(0);
    expect(daySchedule([slot], [c], "2026-11-29")[0]).toMatchObject({
      room: "B",
      startMinutes: 690,
      changeNote: "تعويض",
    });
  });
  it("resolves Cairo date around UTC midnight", () => {
    expect(cairoClock(new Date("2026-11-27T23:30:00Z"))).toMatchObject({
      date: "2026-11-28",
      day: "Saturday",
      minutes: 90,
    });
  });
  it("proposes different curricula for level zero and one", () => {
    expect(suggestedCodes(0, 1)).toContain("GEN111");
    expect(suggestedCodes(1, 1)).toContain("GEN254");
    expect(suggestedCodes(1, 1)).not.toContain("GEN111");
  });
});
