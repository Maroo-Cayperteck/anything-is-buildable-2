export type ScheduleChoice = {
  group_number: number | null;
  section_number: number | null;
  lab_number: number | null;
};
export function matchesChoice(slot: ScheduleChoice, choice: ScheduleChoice) {
  return (
    (!slot.group_number || slot.group_number === choice.group_number) &&
    (!slot.section_number || slot.section_number === choice.section_number) &&
    (!slot.lab_number || slot.lab_number === choice.lab_number)
  );
}
export function arabicGroupSuggestion(name: string, groups = 2, sections = 3) {
  const letters = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
  const clean = name
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F\u0640]/g, "");
  const index = letters.indexOf(clean[0] ?? "");
  if (index < 0) return null;
  return {
    group: Math.min(groups, 1 + Math.floor((index * groups) / letters.length)),
    section: Math.min(sections, 1 + Math.floor((index * sections) / letters.length)),
    lab: Math.min(sections, 1 + Math.floor((index * sections) / letters.length)),
  };
}
export function overlappingSlots(
  slots: { id: string; day: string; startMinutes: number; endMinutes: number }[],
) {
  const pairs: string[][] = [];
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++)
      if (
        slots[i]!.day === slots[j]!.day &&
        slots[i]!.startMinutes < slots[j]!.endMinutes &&
        slots[j]!.startMinutes < slots[i]!.endMinutes
      )
        pairs.push([slots[i]!.id, slots[j]!.id]);
  return pairs;
}
