import { jumpToPreview } from "./preview-pane";
import { usePreviewSource } from "./preview-provider";

/** Only where the pane sits below the list: from 1200px it is already in view, so it is not drawn. */
export function SeePreviewButton() {
  if (!usePreviewSource()) return null;
  return (
    <button
      type="button"
      onClick={jumpToPreview}
      className="min-h-11 text-sm font-semibold underline underline-offset-4 min-[1200px]:hidden"
    >
      see the preview
    </button>
  );
}
