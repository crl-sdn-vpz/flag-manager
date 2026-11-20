import { Outlet } from "@tanstack/react-router";
import { site } from "@/lib/site";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-bg font-sans text-fg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-3 font-semibold">{site.name}</div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
