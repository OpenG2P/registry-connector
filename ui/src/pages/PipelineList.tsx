import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, RefreshCw, PlayCircle, Eye } from "lucide-react";
import { api } from "../api/client";
import { formatApiError } from "../api/errors";
import type { Connector } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import { formatLocal } from "../lib/time";

const PUSH_TRANSPORTS = new Set(["webhook", "websub"]);

export default function PipelineList() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setConnectors(await api.listConnectors());
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete pipeline "${name}"?`)) return;
    try {
      await api.deleteConnector(id);
      load();
    } catch (e: unknown) {
      setError(formatApiError(e));
    }
  };

  const handlePoll = async (id: string, name: string) => {
    try {
      const r = await api.pollNow(id);
      setError("");
      alert(`Poll queued for "${name}" (task ${r.task_id.slice(0, 8)}). Open the pipeline to watch progress.`);
    } catch (e: unknown) {
      setError(formatApiError(e));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-neutral-first">Integration Pipelines</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-first bg-neutral-second border border-primary-second rounded-[10px] hover:bg-secondary-first transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <Link
            to="/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-neutral-first rounded-[10px] hover:opacity-90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Pipeline
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-[10px] bg-toast-failed/10 border border-toast-failed/40 text-toast-failed text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-secondary-third">Loading…</div>
      ) : connectors.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-secondary-third mb-4">No pipelines configured yet.</p>
          <Link
            to="/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-neutral-first rounded-[10px] hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Create your first pipeline
          </Link>
        </div>
      ) : (
        <div className="bg-neutral-second rounded-[10px] border border-primary-second shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-secondary-second">
              <thead className="bg-secondary-first">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-third uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-third uppercase tracking-wider">Platform</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-third uppercase tracking-wider">Transport</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-third uppercase tracking-wider">Auth</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-third uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-third uppercase tracking-wider">Last Poll</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary-third uppercase tracking-wider">Poll Result</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-secondary-third uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-second">
                {connectors.map((c) => (
                  <tr key={c.connector_id} className="hover:bg-[#faf8f2] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-neutral-first">
                      <Link to={`/pipelines/${c.connector_id}`} className="hover:text-primary-second hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-third">{c.platform}</td>
                    <td className="px-4 py-3 text-sm">
                      <code className="text-xs bg-secondary-second px-1.5 py-0.5 rounded">{c.transport_type}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-third">{c.auth_type}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge enabled={c.enabled} paused={c.paused} />
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-third">
                      {c.last_poll_at ? formatLocal(c.last_poll_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <PollResult
                        status={c.last_poll_status}
                        error={c.last_poll_error}
                        fetched={c.last_poll_fetched}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => navigate(`/pipelines/${c.connector_id}`)}
                          className="p-1.5 rounded hover:bg-secondary-second text-secondary-third hover:text-neutral-first"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!PUSH_TRANSPORTS.has(c.transport_type) && (
                          <button
                            onClick={() => handlePoll(c.connector_id, c.name)}
                            disabled={!c.enabled || c.paused}
                            className="p-1.5 rounded hover:bg-primary-first/20 text-primary-second disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Poll now"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/edit/${c.connector_id}`)}
                          className="p-1.5 rounded hover:bg-secondary-second text-secondary-third hover:text-neutral-first"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.connector_id, c.name)}
                          className="p-1.5 rounded hover:bg-toast-failed/10 text-secondary-third hover:text-toast-failed"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PollResult({
  status,
  error,
  fetched,
}: {
  status: string | null;
  error: string | null;
  fetched: number | null;
}) {
  if (!status) return <span className="text-secondary-third">—</span>;
  const tone: Record<string, string> = {
    SUCCESS: "bg-green-100 text-green-800",
    PARTIAL: "bg-yellow-100 text-yellow-800",
    FAILED: "bg-red-100 text-red-800",
  };
  const label =
    status === "FAILED"
      ? "Failed"
      : status === "PARTIAL"
      ? `Partial (${fetched ?? 0})`
      : `OK (${fetched ?? 0})`;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tone[status] || "bg-secondary-second text-neutral-first"}`}
      title={error || ""}
    >
      {label}
    </span>
  );
}
