import { describe, it, expect } from "vitest";
import { matchesChoice, arabicGroupSuggestion, overlappingSlots } from "@/lib/schedule-utils";
describe("Schedule selection and conflicts", () => {
  it("keeps lectures by group and labs independent", () => {
    const choice = { group_number: 2, section_number: 2, lab_number: 3 };
    expect(matchesChoice({ group_number: 1, section_number: null, lab_number: null }, choice)).toBe(
      false,
    );
    expect(matchesChoice({ group_number: null, section_number: null, lab_number: 3 }, choice)).toBe(
      true,
    );
    expect(matchesChoice({ group_number: 2, section_number: 2, lab_number: null }, choice)).toBe(
      true,
    );
  });
  it("allows shared meetings without a distribution filter", () =>
    expect(
      matchesChoice(
        { group_number: null, section_number: null, lab_number: null },
        { group_number: 1, section_number: 1, lab_number: 1 },
      ),
    ).toBe(true));
  it("normalizes Arabic initials and supports seven sections", () => {
    expect(arabicGroupSuggestion("أحمد", 3, 7)).toEqual(arabicGroupSuggestion("احمد", 3, 7));
    expect(arabicGroupSuggestion("يوسف", 3, 7)).toEqual({ group: 3, section: 7, lab: 7 });
    expect(arabicGroupSuggestion("Omar")).toBe(null);
  });
  it("finds overlap but allows adjacent classes and different days", () => {
    expect(
      overlappingSlots([
        { id: "a", day: "Sunday", startMinutes: 480, endMinutes: 600 },
        { id: "b", day: "Sunday", startMinutes: 600, endMinutes: 720 },
        { id: "c", day: "Monday", startMinutes: 480, endMinutes: 600 },
      ]),
    ).toEqual([]);
    expect(
      overlappingSlots([
        { id: "a", day: "Sunday", startMinutes: 480, endMinutes: 601 },
        { id: "b", day: "Sunday", startMinutes: 600, endMinutes: 720 },
      ]),
    ).toEqual([["a", "b"]]);
  });
});
