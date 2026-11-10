"use client";

// On/off toggle. Label it with aria-label, or point a <label htmlFor> at its id.
export default function Switch({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        checked ? "bg-accent" : "bg-line"
      }`}
    >
      <span
        className={`absolute top-1 left-1 size-4 rounded-full shadow transition-transform ${
          checked ? "translate-x-5 bg-on-accent" : "bg-surface"
        }`}
      />
    </button>
  );
}
