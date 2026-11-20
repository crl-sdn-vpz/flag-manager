import { client } from "api-client/client";

/**
 * Point the generated client at the current origin. In dev, Vite proxies /api to the API
 * (VITE_API_PROXY_TARGET); in production, serve the web app and API under one origin or set
 * VITE_API_BASE_URL.
 */
export function configureApiClient(
  baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? window.location.origin,
): void {
  client.setConfig({ baseUrl });
}
