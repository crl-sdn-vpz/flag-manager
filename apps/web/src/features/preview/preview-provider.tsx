import type { FlagFetch } from "flags-sdk";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createPreviewSource, type PreviewSource, type PreviewState } from "./preview-source";

const PreviewContext = createContext<PreviewSource | null>(null);

/** Reads through the page's own origin: Vite proxies /eval to the API in dev, like /api. */
const fetchFromApi: FlagFetch = (path, init) => {
  const base = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
  return window.fetch(new URL(path, base), init);
};

/** One reader for the page, started on mount and stopped on unmount. */
export function PreviewProvider({ children }: { children: ReactNode }) {
  const [source] = useState(() => createPreviewSource(fetchFromApi));
  useEffect(() => {
    source.start();
    return () => source.stop();
  }, [source]);
  return <PreviewContext value={source}>{children}</PreviewContext>;
}

/** The preview's source, or null where no preview is mounted (the list works without it). */
export function usePreviewSource(): PreviewSource | null {
  return useContext(PreviewContext);
}

export function usePreviewState(source: PreviewSource): PreviewState {
  return useSyncExternalStore(source.subscribe, source.getState);
}
