import { useState } from "react";
import { FlagList } from "./flag-list";

export function FlagsPage() {
  // One polite live region for the page: results of create and toggle are read out here.
  const [announcement, setAnnouncement] = useState("");

  return (
    <section aria-labelledby="flags-heading" className="space-y-4">
      <h2 id="flags-heading" className="text-lg font-semibold">
        Flags
      </h2>
      <FlagList announce={setAnnouncement} />
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
