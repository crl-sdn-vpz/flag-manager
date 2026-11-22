import { Button } from "@/components/ui/button";
import { usePreviewSource, usePreviewState } from "./preview-provider";
import type { PreviewSource } from "./preview-source";
import { Shop } from "./shop";

export const PREVIEW_PANE_ID = "preview";
const PREVIEW_HEADING_ID = "preview-heading";

/** Moves the reader to the pane: used by "see the preview" where the pane sits below the list. */
export function jumpToPreview() {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  document
    .getElementById(PREVIEW_PANE_ID)
    ?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
  document.getElementById(PREVIEW_HEADING_ID)?.focus({ preventScroll: true });
}

function Pane({ source }: { source: PreviewSource }) {
  const { snapshot, failed, changed } = usePreviewState(source);
  const readFailed = failed && snapshot === null;
  const isOn = (key: string) => snapshot?.flags[key] === true;

  return (
    <section
      id={PREVIEW_PANE_ID}
      aria-label="Preview"
      className="preview-sticky min-w-0 scroll-mt-4 space-y-4 rounded-md border border-line bg-surface p-4 min-[1200px]:self-start"
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id={PREVIEW_HEADING_ID} tabIndex={-1} className="font-mono font-semibold">
          ~/preview
        </h2>
        <span className="text-sm text-fg-muted">reads 5 flags</span>
      </div>
      {snapshot === null && !failed && (
        <p role="status" className="text-xs text-fg-muted">
          Reading the flags…
        </p>
      )}
      {readFailed && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-danger">
          <p>Couldn't read the flags. Showing the shop as it was.</p>
          <Button variant="secondary" onClick={() => void source.retry()}>
            retry
          </Button>
        </div>
      )}
      {failed && snapshot !== null && (
        <p className="text-sm text-danger">Couldn't refresh the preview. It may be out of date.</p>
      )}
      {snapshot !== null && (
        <p className="text-xs text-fg-muted">It only reads: nothing in it can be pressed.</p>
      )}
      <Shop isOn={isOn} changed={changed} />
    </section>
  );
}

/** The shop, drawn from the flag reader. Renders nothing where no preview is mounted. */
export function PreviewPane() {
  const source = usePreviewSource();
  return source ? <Pane source={source} /> : null;
}
