import {
  PET_VOICE_ACCENTS,
  type PetVoiceAccent,
} from "@/lib/video/accent";

export function PetVoiceAccentPicker({
  value,
  onChange,
}: {
  value: PetVoiceAccent;
  onChange: (value: PetVoiceAccent) => void;
}) {
  return (
    <fieldset className="mt-4 min-w-0">
      <legend className="font-mono text-[9px] font-bold uppercase text-ink-muted">
        Voice accent
      </legend>
      <p className="mb-2 mt-0 text-[10px] text-ink-muted">
        Your words stay the same. Choose how the finished voice sounds.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PET_VOICE_ACCENTS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`group flex min-h-16 items-center justify-between gap-3 rounded-xl px-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink ${selected ? "border-2 border-ink bg-yellow shadow-[2px_2px_0_#241a44]" : "border border-[#d8d1df] bg-white hover:border-purple"}`}
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
            >
              <span>
                <strong className="block text-sm text-ink">{option.label}</strong>
                <small className="font-mono text-[8px] uppercase text-ink-muted">
                  {option.sample}
                </small>
              </span>
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-black ${selected ? "border-ink bg-ink text-white" : "border-ink/20 text-transparent"}`}
                aria-hidden="true"
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
