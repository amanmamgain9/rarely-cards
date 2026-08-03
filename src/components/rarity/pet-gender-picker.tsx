import type { PetPronouns } from "@/lib/analysis/types";

export function PetGenderPicker({
  value,
  onChange,
}: {
  value: PetPronouns | null;
  onChange: (value: "he" | "she") => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="font-mono text-[9px] font-bold uppercase text-ink-muted">
        Voice
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {([
          ["he", "Boy"],
          ["she", "Girl"],
        ] as const).map(([pronouns, label]) => {
          const selected = value === pronouns;
          return (
            <button
              aria-pressed={selected}
              className={`min-h-11 rounded-xl border-2 border-ink font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink ${selected ? "bg-yellow shadow-[3px_3px_0_#241a44]" : "bg-white hover:bg-yellow/35"}`}
              key={pronouns}
              onClick={() => onChange(pronouns)}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
