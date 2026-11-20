import type { Flag } from "api-client";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSetFlagEnabled } from "../api";

const updatedFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const stateWord = (enabled: boolean) => (enabled ? "on" : "off");

type FlagRowProps = { flag: Flag; announce: (message: string) => void };

export function FlagRow({ flag, announce }: FlagRowProps) {
  const toggle = useSetFlagEnabled();
  const switchRef = useRef<HTMLButtonElement>(null);

  const setEnabled = (enabled: boolean) =>
    toggle.mutate(
      { path: { key: flag.key }, body: { enabled } },
      {
        onSuccess: () => announce(`${flag.name} turned ${stateWord(enabled)}.`),
        onError: () => announce(`Couldn't turn ${stateWord(enabled)} ${flag.name}.`),
      },
    );

  const failedEnabled = toggle.isError ? toggle.variables?.body.enabled : undefined;

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{flag.name}</p>
        <p className="font-mono text-sm text-fg-muted">{flag.key}</p>
        {flag.description && <p className="text-sm text-fg-muted">{flag.description}</p>}
        <p className="text-xs text-fg-muted">
          Updated{" "}
          <time dateTime={flag.updatedAt}>{updatedFormat.format(new Date(flag.updatedAt))}</time>
        </p>
        {failedEnabled !== undefined && (
          <div className="flex items-center gap-3 text-sm text-danger">
            <p>
              Couldn't turn {stateWord(failedEnabled)} {flag.name}.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                // Retry unmounts this button; move focus to the switch it retries, not <body>.
                switchRef.current?.focus();
                setEnabled(failedEnabled);
              }}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
      <Switch
        ref={switchRef}
        checked={flag.enabled}
        onCheckedChange={setEnabled}
        label={flag.name}
        busy={toggle.isPending}
      />
    </li>
  );
}
