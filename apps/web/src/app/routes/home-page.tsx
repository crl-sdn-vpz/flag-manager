import { FlagsPage } from "@/features/flags";
import { PreviewPane, PreviewProvider } from "@/features/preview";
import { site } from "@/lib/site";

export function HomePage() {
  return (
    <PreviewProvider>
      {/* From 1200px the shop sits right of the list; below that it follows the list. */}
      <div className="space-y-8 min-[1200px]:grid min-[1200px]:grid-cols-[minmax(0,720px)_minmax(340px,400px)] min-[1200px]:gap-x-12 min-[1200px]:space-y-0">
        <div className="space-y-8">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold">{site.name}</h1>
            <p className="text-fg-muted">{site.description}</p>
          </header>
          <FlagsPage />
        </div>
        <PreviewPane />
      </div>
    </PreviewProvider>
  );
}
