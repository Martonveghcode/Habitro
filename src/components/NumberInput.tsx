import { useState, type InputHTMLAttributes } from "react";

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"
> & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
};

// Keep an unfinished edit local so clearing a field does not reset its value
// or rebuild the exercise until the user leaves the field or presses Enter.
export function NumberInput({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string): string => {
    const parsed = text.trim() ? Number(text) : NaN;
    const next = Number.isFinite(parsed)
      ? Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.round(parsed)))
      : value;
    if (next !== value) onValueChange(next);
    return String(next);
  };

  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft ?? value}
      onFocus={(event) => {
        setDraft(event.currentTarget.value);
        onFocus?.(event);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        commit(event.currentTarget.value);
        setDraft(null);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter") {
          event.preventDefault();
          setDraft(commit(event.currentTarget.value));
        } else if (event.key === "Escape") {
          event.preventDefault();
          setDraft(String(value));
        }
      }}
    />
  );
}
