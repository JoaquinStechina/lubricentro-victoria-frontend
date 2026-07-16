"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeText } from "@/app/lib/text";

function filterAccentInsensitive(value: string, search: string) {
  return normalizeText(value).includes(normalizeText(search)) ? 1 : 0;
}

type ComboboxFilterProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
  searchPlaceholder: string;
};

export default function ComboboxFilter({
  label,
  value,
  onChange,
  options,
  allLabel,
  searchPlaceholder,
}: ComboboxFilterProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" className="w-full justify-between font-normal" />
          }
        >
          <span className="truncate">{value || allLabel}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
          <Command filter={filterAccentInsensitive}>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={allLabel}
                  data-checked={value === ""}
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  {allLabel}
                </CommandItem>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    data-checked={value === option}
                    onSelect={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                  >
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
