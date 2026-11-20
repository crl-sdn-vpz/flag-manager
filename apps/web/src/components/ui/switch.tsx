import { cn } from "@/lib/cn";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name; include what the switch controls, e.g. the flag's name. */
  label: string;
  /** While true the switch keeps focus but ignores input (a request is in flight). */
  busy?: boolean;
};

/**
 * A button with role="switch". State is shown by text and knob position, not colour alone.
 * Busy uses aria-disabled instead of disabled so keyboard focus is not lost mid-request.
 */
export function Switch({ checked, onCheckedChange, label, busy = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={() => {
        if (!busy) onCheckedChange(!checked);
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm",
        busy && "cursor-wait opacity-70",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent" : "bg-off",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-surface shadow transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </span>
      <span aria-hidden="true" className="w-7 text-left font-medium">
        {checked ? "On" : "Off"}
      </span>
    </button>
  );
}
