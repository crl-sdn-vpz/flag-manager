import { FlagList } from "./flag-list";

export function FlagsPage() {
  return (
    <section aria-labelledby="flags-heading" className="space-y-4">
      <h2 id="flags-heading" className="text-lg font-semibold">
        Flags
      </h2>
      <FlagList />
    </section>
  );
}
