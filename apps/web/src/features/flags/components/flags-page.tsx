import { useState } from "react";
import { CreateFlagForm } from "./create-flag-form";
import { FlagList } from "./flag-list";

export function FlagsPage() {
  // One polite live region for the page: results of create and toggle are read out here.
  const [announcement, setAnnouncement] = useState("");

  return (
    <div className="space-y-8">
      <CreateFlagForm announce={setAnnouncement} />
      <section aria-labelledby="flags-heading" className="space-y-4">
        <h2 id="flags-heading" className="text-lg font-semibold">
          Flags
        </h2>
        <FlagList announce={setAnnouncement} />
      </section>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
