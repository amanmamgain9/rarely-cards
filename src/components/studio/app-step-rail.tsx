export function AppStepRail({ active }: { active: 0 | 1 | 2 }) {
  return (
    <ol className="my-8 grid list-none grid-cols-3 p-0" aria-label="Video creation progress">
      {["Photo", "Line", "Video"].map((label, index) => (
        <li
          key={label}
          className={`relative flex min-w-0 flex-col items-center gap-2 font-mono text-[10px] font-medium max-[700px]:gap-1.5 max-[700px]:text-[8px] ${index <= active ? "text-ink" : "text-[#958ba5]"}`}
          aria-current={index === active ? "step" : undefined}
        >
          {index < 2 && (
            <span
              aria-hidden="true"
              className={`absolute left-1/2 top-4 h-[3px] w-full -translate-y-1/2 border-y border-ink/10 ${index < active ? "bg-pink" : "bg-[#ddd6e4]"}`}
            />
          )}
          <span
            className={`relative z-10 grid size-8 place-items-center rounded-full border-2 font-black text-ink ${
              index < active
                ? "border-ink bg-pink"
                : index === active
                  ? "border-ink bg-yellow shadow-[2px_2px_0_#241a44]"
                  : "border-[#b8aec4] bg-white"
            }`}
          >
            {index < active ? "✓" : index + 1}
          </span>
          <b className="truncate">{label}</b>
        </li>
      ))}
    </ol>
  );
}
