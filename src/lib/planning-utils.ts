import { z } from "zod";
import curriculum from "./curriculum-data.json";
export const distributionSchema = z.object({
  group_number: z.number().int().min(1).max(20).nullable(),
  section_number: z.number().int().min(1).max(30).nullable(),
  lab_number: z.number().int().min(1).max(30).nullable(),
});
export const planItemSchema = distributionSchema.extend({
  courseId: z.string().uuid(),
  offeringId: z.string().uuid().optional(),
});
export type PlanItem = z.infer<typeof planItemSchema>;
export function readPlanItems(value: unknown): PlanItem[] {
  return z.array(planItemSchema).max(20).parse(value);
}
export function suggestedCodes(level: number, term: number) {
  const codes = curriculum.courses
    .filter((x) => !x.pool && x.level === level && x.term === term)
    .map((x) => x.code);
  if (level === 1 && term === 1) codes.push("GEN254");
  return [...new Set(codes)];
}
export const validTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
export const validDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (x) => !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x,
    "تاريخ غير صحيح",
  );
export function cairoClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    day: get("weekday"),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}
export function dateDay(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    new Date(date + "T12:00:00Z"),
  );
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export type DatedChange = {
  slot_id: string;
  occurrence_date: string;
  cancelled: boolean;
  replacement_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  note: string;
};
export type WeeklySlot = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  room: string;
  course: string;
  courseCode: string;
  kind: string;
};
export function daySchedule<T extends WeeklySlot>(
  slots: T[],
  changes: DatedChange[],
  date: string,
) {
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const result = slots
    .filter(
      (s) =>
        s.day === dateDay(date) &&
        !changes.some((c) => c.slot_id === s.id && c.occurrence_date === date),
    )
    .map((s) => ({ ...s, changeNote: "", occurrenceDate: date }));
  for (const c of changes.filter((c) => !c.cancelled && c.replacement_date === date)) {
    const s = slots.find((s) => s.id === c.slot_id);
    if (s && c.start_time && c.end_time)
      result.push({
        ...s,
        day: dateDay(date),
        startTime: c.start_time.slice(0, 5),
        endTime: c.end_time.slice(0, 5),
        startMinutes: mins(c.start_time),
        endMinutes: mins(c.end_time),
        room: c.location ?? s.room,
        changeNote: c.note || "موعد تعويضي",
        occurrenceDate: date,
      });
  }
  return result.sort((a, b) => a.startMinutes - b.startMinutes);
}
// Supports Excel CSV exports and pasted worksheet rows, including quoted names/commas.
export function parseRoster(text: string) {
  const delimiter = text.split(/\r?\n/)[0]?.includes("\t")
    ? "\t"
    : text.split(/\r?\n/)[0]?.includes(";")
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (ch === delimiter || ch === "\n")) {
      row.push(cell.trim());
      cell = "";
      if (ch === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (ch !== "\r") cell += ch;
  }
  if (quoted) throw new Error("علامات اقتباس غير مكتملة في الملف");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const header = rows.shift()?.map((x) => x.toLowerCase()) ?? [];
  const required = ["student_code", "level", "group", "section", "lab"];
  if (required.some((x) => !header.includes(x)))
    throw new Error("العناوين المطلوبة: student_code,level,group,section,lab");
  if (rows.length > 1000) throw new Error("الحد الأقصى 1000 صف");
  const seen = new Set<string>();
  return rows.map((r, index) => {
    const get = (k: string) => r[header.indexOf(k)] ?? "";
    const norm = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
    const code = norm(get("student_code"));
    const errors: string[] = [];
    if (!/^9252500\d{2}$/.test(code)) errors.push("رقم جامعي غير صحيح");
    if (seen.has(code)) errors.push("رقم مكرر");
    seen.add(code);
    const level = Number(norm(get("level")));
    if (!get("level") || !Number.isInteger(level) || level < 0 || level > 3)
      errors.push("مستوى غير صحيح");
    const number = (k: string, max: number) => {
      const raw = norm(get(k));
      const n = raw ? Number(raw) : null;
      if (n !== null && (!Number.isInteger(n) || n < 1 || n > max)) errors.push(`${k} غير صحيح`);
      return n;
    };
    return {
      row: index + 2,
      student_code: code,
      level,
      group_number: number("group", 20),
      section_number: number("section", 30),
      lab_number: number("lab", 30),
      errors,
    };
  });
}
