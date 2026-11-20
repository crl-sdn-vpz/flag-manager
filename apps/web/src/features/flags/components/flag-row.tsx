import type { Flag } from "api-client";

const updatedFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function FlagRow({ flag }: { flag: Flag }) {
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{flag.name}</p>
        <p className="font-mono text-sm text-fg-muted">{flag.key}</p>
        {flag.description && <p className="text-sm text-fg-muted">{flag.description}</p>}
        <p className="text-xs text-fg-muted">
          Updated{" "}
          <time dateTime={flag.updatedAt}>{updatedFormat.format(new Date(flag.updatedAt))}</time>
        </p>
      </div>
    </li>
  );
}
