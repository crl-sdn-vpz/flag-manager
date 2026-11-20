import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/app";
import { configureApiClient } from "@/lib/api";
import "@/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

configureApiClient();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
