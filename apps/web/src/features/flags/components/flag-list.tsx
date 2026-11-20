import { Button } from "@/components/ui/button";
import { useFlags } from "../api";
import { FlagRow } from "./flag-row";

export function FlagList() {
  const flags = useFlags();

  if (flags.isPending) {
    return <p role="status">Loading flags…</p>;
  }
  if (flags.isError) {
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
    <ul
      aria-label="Flags"
      className="divide-y divide-line rounded-md border border-line bg-surface"
    >
      {flags.data.items.map((flag) => (
        <FlagRow key={flag.key} flag={flag} />
      ))}
    </ul>
  );
}
