import { Button } from "@/components/ui/button";
import { useFlags } from "../api";
import { FlagRow } from "./flag-row";

export function FlagList({ announce }: { announce: (message: string) => void }) {
  const flags = useFlags();

  if (flags.isPending) {
    return <p role="status">Loading flags…</p>;
  }
  // No data at all: the error replaces the list.
  if (flags.isError && !flags.data) {
    return (
      <div role="alert" className="space-y-3 rounded-md bg-danger-surface p-4 text-danger">
        <p>Couldn't load flags. Check that the API is running, then try again.</p>
        <Button variant="secondary" onClick={() => void flags.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (flags.data.items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line p-6 text-center text-fg-muted">
        No flags yet.{" "}
        <a href="#flag-key" className="text-accent underline">
          Create your first flag
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* A failed background refresh keeps the last good list (and any row errors) visible. */}
      {flags.isError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-md bg-danger-surface px-4 py-2 text-sm text-danger"
        >
          <p>Couldn't refresh flags. The list may be out of date.</p>
          <Button variant="secondary" onClick={() => void flags.refetch()}>
            Retry
          </Button>
        </div>
      )}
      <ul
        aria-label="Flags"
        className="divide-y divide-line rounded-md border border-line bg-surface"
      >
        {flags.data.items.map((flag) => (
          <FlagRow key={flag.key} flag={flag} announce={announce} />
        ))}
      </ul>
    </div>
  );
}
