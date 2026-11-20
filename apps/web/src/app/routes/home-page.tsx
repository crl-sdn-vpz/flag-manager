import { FlagsPage } from "@/features/flags";
import { site } from "@/lib/site";

export function HomePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{site.name}</h1>
        <p className="text-fg-muted">{site.description}</p>
      </header>
      <FlagsPage />
    </div>
  );
}
