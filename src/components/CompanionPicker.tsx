import { Check } from "lucide-react";
import { companions } from "@/lib/companions";
import type { Language } from "@/lib/types";

export function CompanionPicker({ value, onSelect, language = "ru", disabled, taken }: {
  value: string;
  onSelect: (value: string) => void;
  language?: Language;
  disabled?: boolean;
  taken?: Set<string>;
}) {
  return (
    <div className="companion-choices">
      {companions.map(companion => (
        <button key={companion.value} type="button" aria-pressed={value === companion.value}
          aria-label={companion.name[language]} title={taken?.has(companion.value) && companion.value !== value
            ? { ru: "Уже у другого читателя", kk: "Басқа оқырман таңдаған", en: "Chosen by another reader" }[language] : companion.name[language]}
          disabled={disabled || (taken?.has(companion.value) && companion.value !== value)}
          onClick={() => onSelect(companion.value)}>
          <img src={companion.image} width={64} height={64} alt="" />
          {value === companion.value && <span aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}
        </button>
      ))}
    </div>
  );
}
