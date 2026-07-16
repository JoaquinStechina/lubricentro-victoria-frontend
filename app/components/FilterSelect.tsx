"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
};

export default function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: FilterSelectProps) {
  const items = [
    { value: "", label: allLabel },
    ...options.map((option) => ({ value: option, label: option })),
  ];

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => onChange((next as string) ?? "")}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.label} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
