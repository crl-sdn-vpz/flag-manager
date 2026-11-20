import { HealthStatus } from "@/features/health";
import { site } from "@/lib/site";

export function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{site.name}</h1>
      <p className="text-slate-600">{site.description}</p>
      <HealthStatus />
    </section>
  );
}
