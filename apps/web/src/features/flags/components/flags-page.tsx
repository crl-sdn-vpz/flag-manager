import { useCallback, useState } from "react";
import { CreateFlagForm } from "./create-flag-form";
import { FlagList } from "./flag-list";

type Announcement = { id: number; text: string };

export function FlagsPage() {
  // One polite live region for the page: results of create and toggle are read out here.
  const [announcement, setAnnouncement] = useState<Announcement>({ id: 0, text: "" });
  const announce = useCallback(
    (text: string) => setAnnouncement((previous) => ({ id: previous.id + 1, text })),
    [],
  );

  return (
    <div className="space-y-8">
      <CreateFlagForm announce={announce} />
      <section aria-labelledby="flags-heading" className="space-y-4">
        <h2 id="flags-heading" className="text-lg font-semibold">
          Flags
        </h2>
        <FlagList announce={announce} />
      </section>
      <div role="status" aria-live="polite" className="sr-only">
        {/* A new node per message, so screen readers re-read even an identical message. */}
        <span key={announcement.id}>{announcement.text}</span>
      </div>
    </div>
  );
}
