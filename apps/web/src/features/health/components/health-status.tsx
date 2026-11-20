import { Badge } from "@/components/ui/badge";
import { useHealth } from "../api";

export function HealthStatus() {
  const health = useHealth();

  if (health.isPending) {
    return <p role="status">Checking API…</p>;
  }
  if (health.isError) {
    return (
      <p role="alert" className="text-red-700">
        API unreachable. Is <code>just dev</code> running?
      </p>
    );
  }

  const { status, version, database } = health.data;
  return (
    <dl className="flex flex-wrap items-center gap-2" aria-label="API health">
      <dt className="text-slate-600">API</dt>
      <dd>
        <Badge tone={status === "ok" ? "success" : "warning"}>{status}</Badge>
      </dd>
      <dt className="text-slate-600">Database</dt>
      <dd>
        <Badge tone={database === "unavailable" ? "danger" : "neutral"}>{database}</Badge>
      </dd>
      <dt className="text-slate-600">Version</dt>
      <dd>{version}</dd>
    </dl>
  );
}
