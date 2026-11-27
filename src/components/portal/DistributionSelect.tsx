import { useState } from "react";
import type { ScheduleChoice } from "@/lib/schedule-utils";

export const distributionFields = [
  ["group_number", "الجروب", 20],
  ["section_number", "السيكشن", 30],
  ["lab_number", "اللاب", 30],
] as const;

type Field = (typeof distributionFields)[number];
export function DistributionSelect({
  field: [key, label, max],
  slots,
  choice,
  name,
  onChange,
}: {
  field: Field;
  slots: ScheduleChoice[];
  choice: Partial<ScheduleChoice>;
  name: string;
  onChange: (value: number | null) => void;
}) {
  const value = choice[key] ?? null;
  const [manual, setManual] = useState(false);
  const compatible = slots.filter(
    (slot) =>
      (key === "group_number" ||
        !choice.group_number ||
        !slot.group_number ||
        slot.group_number === choice.group_number) &&
      (key !== "lab_number" ||
        !choice.section_number ||
        !slot.section_number ||
        slot.section_number === choice.section_number),
  );
  const options = [
    ...new Set(compatible.flatMap((slot) => (slot[key] === null ? [] : [slot[key]]))),
  ].sort((a, b) => a - b);
  const custom = manual || (value !== null && !options.includes(value));

  return (
    <div className="min-w-0 space-y-1">
      <label className="block">
        {label}
        <select
          aria-label={name}
          className="block w-full min-w-0 rounded-lg border bg-background p-2"
          value={custom ? "custom" : (value ?? "")}
          onChange={(e) => {
            const next = e.target.value;
            setManual(next === "custom");
            if (next !== "custom") onChange(next ? Number(next) : null);
          }}
        >
          <option value="">لا أعرف</option>
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value="custom">اختيار مخصص</option>
        </select>
      </label>
      {custom && (
        <input
          aria-label={name + " (رقم مخصص)"}
          type="number"
          inputMode="numeric"
          className="block w-full min-w-0 rounded-lg border bg-background p-2"
          min={1}
          max={max}
          value={value ?? ""}
          placeholder="الرقم"
          onChange={(e) => {
            setManual(true);
            const n = e.target.valueAsNumber;
            if (!e.target.value) onChange(null);
            else if (Number.isInteger(n) && n >= 1 && n <= max) onChange(n);
          }}
        />
      )}
    </div>
  );
}
