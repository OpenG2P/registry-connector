import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "../api/client";
import { formatApiError } from "../api/errors";
import type {
  ConnectorMeta,
  ConnectorCreate,
  MetadataList,
} from "../api/types";
import Card from "../components/Card";
import { EDRMC_WEBSUB_UD } from "../lib/edrmc-websub-template";

const CURSOR_KEYS = [
  "incremental_field",
  "incremental_mode",
  "page_size",
  "max_pages",
  "http_timeout_seconds",
  "partner_ingest_timeout_seconds",
  "partner_public_key_pem",
  "partner_json_web_key_set_url",
  "partner_jwks_url",
] as const;

type SourceExtras = {
  incremental_field: string;
  incremental_mode: string;
  page_size: string;
  max_pages: string;
  http_timeout_seconds: string;
  partner_ingest_timeout_seconds: string;
  partner_public_key_pem: string;
  partner_json_web_key_set_url: string;
  advanced_json: string;
};

const EMPTY_EXTRAS: SourceExtras = {
  incremental_field: "",
  incremental_mode: "timestamp",
  page_size: "",
  max_pages: "",
  http_timeout_seconds: "",
  partner_ingest_timeout_seconds: "",
  partner_public_key_pem: "",
  partner_json_web_key_set_url: "",
  advanced_json: "",
};

const EMPTY: ConnectorCreate = {
  name: "",
  platform: "",
  transport_type: "",
  enabled: true,
  paused: false,
  data_model_mnemonic: "",
  mapper_expression: "",
  g2p_sender_id: "",
  g2p_register_mnemonic: "",
  source_config_json: "",
  auth_type: "none",
  auth_secret_json: "",
  webhook_secret: "",
  webhook_path_slug: "",
  webhook_verifier: "hmac_sha256",
  max_in_flight: null,
  validation_schema_json: "",
};

function parseSourceConfig(raw: string | null | undefined): SourceExtras {
  if (!raw?.trim()) return { ...EMPTY_EXTRAS };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const advanced: Record<string, unknown> = { ...obj };
    for (const key of CURSOR_KEYS) delete advanced[key];
    return {
      incremental_field: String(obj.incremental_field ?? ""),
      incremental_mode: String(obj.incremental_mode ?? "timestamp"),
      page_size: obj.page_size != null ? String(obj.page_size) : "",
      max_pages: obj.max_pages != null ? String(obj.max_pages) : "",
      http_timeout_seconds:
        obj.http_timeout_seconds != null ? String(obj.http_timeout_seconds) : "",
      partner_ingest_timeout_seconds:
        obj.partner_ingest_timeout_seconds != null
          ? String(obj.partner_ingest_timeout_seconds)
          : "",
      partner_public_key_pem: String(obj.partner_public_key_pem ?? ""),
      partner_json_web_key_set_url: String(
        obj.partner_json_web_key_set_url ?? obj.partner_jwks_url ?? ""
      ),
      advanced_json: Object.keys(advanced).length
        ? JSON.stringify(advanced, null, 2)
        : "",
    };
  } catch {
    return { ...EMPTY_EXTRAS, advanced_json: raw || "" };
  }
}

function buildSourceConfigJson(extras: SourceExtras): string {
  let advanced: Record<string, unknown> = {};
  if (extras.advanced_json.trim()) {
    advanced = JSON.parse(extras.advanced_json) as Record<string, unknown>;
  }
  const merged: Record<string, unknown> = { ...advanced };
  if (extras.incremental_field.trim()) {
    merged.incremental_field = extras.incremental_field.trim();
  }
  if (extras.incremental_mode.trim()) {
    merged.incremental_mode = extras.incremental_mode.trim();
  }
  if (extras.page_size.trim()) merged.page_size = Number(extras.page_size);
  if (extras.max_pages.trim()) merged.max_pages = Number(extras.max_pages);
  if (extras.http_timeout_seconds.trim()) {
    merged.http_timeout_seconds = Number(extras.http_timeout_seconds);
  }
  if (extras.partner_ingest_timeout_seconds.trim()) {
    merged.partner_ingest_timeout_seconds = Number(
      extras.partner_ingest_timeout_seconds
    );
  }
  if (extras.partner_public_key_pem.trim()) {
    merged.partner_public_key_pem = extras.partner_public_key_pem.trim();
  }
  if (extras.partner_json_web_key_set_url.trim()) {
    merged.partner_json_web_key_set_url =
      extras.partner_json_web_key_set_url.trim();
  }
  return Object.keys(merged).length ? JSON.stringify(merged, null, 2) : "";
}

export default function PipelineForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [meta, setMeta] = useState<ConnectorMeta | null>(null);
  const [partners, setPartners] = useState<MetadataList | null>(null);
  const [registers, setRegisters] = useState<MetadataList | null>(null);
  const [form, setForm] = useState<ConnectorCreate>({ ...EMPTY });
  const [extras, setExtras] = useState<SourceExtras>({ ...EMPTY_EXTRAS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [metaResponse, partnersResponse, registersResponse] =
          await Promise.all([
            api.meta(),
            api.listPartners().catch(() => ({ configured: false, items: [] })),
            api.listRegisters().catch(() => ({ configured: false, items: [] })),
          ]);
        setMeta(metaResponse);
        setPartners(partnersResponse);
        setRegisters(registersResponse);
        if (id) {
          const connector = await api.getConnector(id);
          setForm({
            name: connector.name,
            platform: connector.platform,
            transport_type: connector.transport_type,
            enabled: connector.enabled,
            paused: connector.paused,
            data_model_mnemonic: connector.data_model_mnemonic || "",
            mapper_expression: connector.mapper_expression || "",
            g2p_sender_id: connector.g2p_sender_id || "",
            g2p_register_mnemonic: connector.g2p_register_mnemonic || "",
            source_config_json: connector.source_config_json || "",
            auth_type: connector.auth_type,
            auth_secret_json: "",
            webhook_secret: "",
            webhook_path_slug: connector.webhook_path_slug || "",
            webhook_verifier: connector.webhook_verifier,
            max_in_flight: connector.max_in_flight,
            validation_schema_json: connector.validation_schema_json || "",
          });
          setExtras(parseSourceConfig(connector.source_config_json));
        }
      } catch (e: unknown) {
        setError(formatApiError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const setField = <K extends keyof ConnectorCreate>(
    key: K,
    value: ConnectorCreate[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const setSourceExtra = <K extends keyof SourceExtras>(
    key: K,
    value: SourceExtras[K]
  ) => setExtras((prev) => ({ ...prev, [key]: value }));

  const transportHint = meta?.transport_hints[form.transport_type] || "";
  const isWebhook = transportHint === "webhook";
  const isPoll = transportHint === "poll";
  const isConsumer = transportHint === "consumer";
  const isWebSub = form.transport_type === "websub";
  const usesJsonWebTokenVerifier = form.webhook_verifier === "jwt_signature";

  const showSourceCard = isPoll || isConsumer || isWebhook;

  const verifiers = useMemo(() => {
    const list = meta?.webhook_verifiers || [];
    if (!list.includes("jwt_signature")) return [...list, "jwt_signature"];
    return list;
  }, [meta]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let source_config_json: string | undefined;
      try {
        source_config_json = buildSourceConfigJson(extras) || undefined;
      } catch {
        setError("Source config JSON is invalid");
        setSaving(false);
        return;
      }

      const payload: Record<string, unknown> = {
        ...form,
        source_config_json,
      };
      if (!payload.auth_secret_json) delete payload.auth_secret_json;
      if (!payload.webhook_secret) delete payload.webhook_secret;
      if (!payload.source_config_json) delete payload.source_config_json;
      if (!payload.validation_schema_json) delete payload.validation_schema_json;
      if (!payload.mapper_expression) delete payload.mapper_expression;
      if (payload.max_in_flight === null || payload.max_in_flight === undefined) {
        delete payload.max_in_flight;
      }

      if (isEdit && id) {
        await api.updateConnector(id, payload);
      } else {
        await api.createConnector(payload as unknown as ConnectorCreate);
      }
      navigate("/");
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-secondary-third">Loading…</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="p-2 rounded-[10px] hover:bg-secondary-second text-secondary-third"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-neutral-first">
            {isEdit ? "Edit Pipeline" : "New Pipeline"}
          </h1>
        </div>
        {!isEdit && (
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-[10px] border border-primary-second bg-primary-first/20 text-neutral-first hover:bg-primary-first/30"
            onClick={() => {
              setForm({
                ...EMPTY,
                ...EDRMC_WEBSUB_UD,
                auth_secret_json: "",
                webhook_secret: "",
              });
              setExtras(parseSourceConfig(EDRMC_WEBSUB_UD.source_config_json));
            }}
          >
            Apply EDRMC → UD WebSub template
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-[10px] bg-toast-failed/10 border border-toast-failed text-toast-failed text-sm">
          {error}
        </div>
      )}

      <Card title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name" required>
            <input
              required
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="input"
              placeholder="ODK Household Poll"
            />
          </Field>
          <Field label="Platform" required>
            <input
              required
              value={form.platform}
              onChange={(e) => setField("platform", e.target.value)}
              className="input"
              placeholder="odk, generic, kafka_registry_events…"
            />
          </Field>
          <Field label="Transport Type" required>
            <select
              required
              value={form.transport_type}
              onChange={(e) => setField("transport_type", e.target.value)}
              className="input"
            >
              <option value="">Select…</option>
              {meta?.transport_types.map((t) => (
                <option key={t} value={t}>
                  {t} ({meta.transport_hints[t] || "unknown"})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data Model Mnemonic">
            <input
              value={form.data_model_mnemonic || ""}
              onChange={(e) => setField("data_model_mnemonic", e.target.value)}
              className="input"
              placeholder="ODK_HOUSEHOLD"
            />
          </Field>
        </div>
        <div className="flex gap-6 mt-4">
          <label className="flex items-center gap-2 text-sm text-neutral-first cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setField("enabled", e.target.checked)}
              className="rounded border-primary-second text-primary-second focus:ring-primary-first"
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-first cursor-pointer">
            <input
              type="checkbox"
              checked={form.paused}
              onChange={(e) => setField("paused", e.target.checked)}
              className="rounded border-primary-second text-primary-second focus:ring-primary-first"
            />
            Paused
          </label>
        </div>
      </Card>

      <Card
        title="Registry Delivery"
        subtitle="Sender and target register for the Partner API envelope."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Sender (Partner Mnemonic)"
            required
            hint={
              partners?.configured === false
                ? "Metadata DSN not set — type a mnemonic manually."
                : "Must match an active partner in the registry."
            }
          >
            <MetadataSelectOrInput
              value={form.g2p_sender_id}
              onChange={(v) => setField("g2p_sender_id", v)}
              source={partners}
              placeholder="test-partner"
              required
            />
          </Field>
          <Field
            label="Target Register"
            required
            hint={
              registers?.configured === false
                ? "Metadata DSN not set — type a register mnemonic manually."
                : undefined
            }
          >
            <MetadataSelectOrInput
              value={form.g2p_register_mnemonic}
              onChange={(v) => setField("g2p_register_mnemonic", v)}
              source={registers}
              placeholder="farmer_register"
              required
            />
          </Field>
        </div>
      </Card>

      {showSourceCard && (
        <Card title="Source Configuration">
          {isPoll && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field
                label="Cursor field"
                hint="Attribute used to request only new records (e.g. __system/submissionDate)."
              >
                <input
                  value={extras.incremental_field}
                  onChange={(e) => setSourceExtra("incremental_field", e.target.value)}
                  className="input"
                  placeholder="__system/submissionDate"
                />
              </Field>
              <Field label="Cursor mode">
                <select
                  value={extras.incremental_mode}
                  onChange={(e) => setSourceExtra("incremental_mode", e.target.value)}
                  className="input"
                >
                  <option value="timestamp">timestamp</option>
                  <option value="updated_at">updated_at</option>
                  <option value="sequence">sequence</option>
                  <option value="full_scan">full_scan</option>
                </select>
              </Field>
              <Field label="Page size">
                <input
                  type="number"
                  min={1}
                  value={extras.page_size}
                  onChange={(e) => setSourceExtra("page_size", e.target.value)}
                  className="input"
                  placeholder="100"
                />
              </Field>
              <Field label="Max pages per fetch">
                <input
                  type="number"
                  min={1}
                  value={extras.max_pages}
                  onChange={(e) => setSourceExtra("max_pages", e.target.value)}
                  className="input"
                  placeholder="50"
                />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field
              label="HTTP timeout (seconds)"
              hint="Source fetch timeout for this pipeline (5–300)."
            >
              <input
                type="number"
                min={5}
                max={300}
                value={extras.http_timeout_seconds}
                onChange={(e) => setSourceExtra("http_timeout_seconds", e.target.value)}
                className="input"
                placeholder="60"
              />
            </Field>
            <Field
              label="Partner ingest timeout (seconds)"
              hint="Outbound registry call timeout for this pipeline (5–300)."
            >
              <input
                type="number"
                min={5}
                max={300}
                value={extras.partner_ingest_timeout_seconds}
                onChange={(e) =>
                  setSourceExtra("partner_ingest_timeout_seconds", e.target.value)
                }
                className="input"
                placeholder="30"
              />
            </Field>
          </div>

          <Field
            label="Additional source config (JSON)"
            hint={
              isWebSub
                ? "hub_url, partner_id, callback_url, topics, data_path"
                : "base_url, project_id, form_id, topic, bootstrap_servers, etc."
            }
          >
            <textarea
              value={extras.advanced_json}
              onChange={(e) => setSourceExtra("advanced_json", e.target.value)}
              className="input font-mono text-sm"
              rows={6}
              placeholder={
                isWebSub
                  ? '{"hub_url": "https://websub.example.org/hub", "topics": ["partner/WEBSUB_INDIVIDUAL_CREATED"]}'
                  : '{"base_url": "https://odk.example.com", "project_id": 1, "form_id": "household"}'
              }
            />
          </Field>
        </Card>
      )}

      <Card title="Authentication">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Auth Type">
            <select
              value={form.auth_type}
              onChange={(e) => setField("auth_type", e.target.value)}
              className="input"
            >
              {meta?.auth_types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          {form.auth_type !== "none" && (
            <Field
              label="Auth Secrets (JSON)"
              hint={isEdit ? "Leave blank to keep existing" : undefined}
            >
              <textarea
                value={form.auth_secret_json || ""}
                onChange={(e) => setField("auth_secret_json", e.target.value)}
                className="input font-mono text-sm"
                rows={4}
                placeholder='{"email": "admin@example.com", "password": "***"}'
              />
            </Field>
          )}
        </div>
      </Card>

      {isWebhook && (
        <Card title={isWebSub ? "WebSub Callback" : "Webhook"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Path Slug" hint="Human-friendly URL alias (optional)">
              <input
                value={form.webhook_path_slug || ""}
                onChange={(e) => setField("webhook_path_slug", e.target.value)}
                className="input"
                placeholder="odk-farm-survey-prod"
              />
            </Field>
            <Field label="Verifier">
              <select
                value={form.webhook_verifier}
                onChange={(e) => setField("webhook_verifier", e.target.value)}
                className="input"
              >
                {verifiers.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            {!usesJsonWebTokenVerifier && (
              <Field
                label="Webhook Secret"
                hint={isEdit ? "Leave blank to keep existing" : undefined}
              >
                <input
                  type="password"
                  value={form.webhook_secret || ""}
                  onChange={(e) => setField("webhook_secret", e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </Field>
            )}
          </div>
          {usesJsonWebTokenVerifier && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field
                label="Partner public key (PEM)"
                hint="Used to verify the partner JSON Web Token on push. Or set a JSON Web Key Set URL."
              >
                <textarea
                  value={extras.partner_public_key_pem}
                  onChange={(e) => setSourceExtra("partner_public_key_pem", e.target.value)}
                  className="input font-mono text-sm"
                  rows={5}
                  placeholder="-----BEGIN PUBLIC KEY-----"
                />
              </Field>
              <Field
                label="Partner JSON Web Key Set URL"
                hint="Fetched at verify time. Takes precedence when set."
              >
                <input
                  value={extras.partner_json_web_key_set_url}
                  onChange={(e) =>
                    setSourceExtra("partner_json_web_key_set_url", e.target.value)
                  }
                  className="input"
                  placeholder="https://partner.example/.well-known/jwks.json"
                />
              </Field>
            </div>
          )}
        </Card>
      )}

      <Card title="Mapping">
        <Field
          label="Mapper Expression (JMESPath)"
          hint="Leave blank for passthrough"
        >
          <textarea
            value={form.mapper_expression || ""}
            onChange={(e) => setField("mapper_expression", e.target.value)}
            className="input font-mono text-sm"
            rows={4}
            placeholder="{name: outer.name, age: outer.age}"
          />
        </Field>
      </Card>

      <Card title="Advanced">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Max In-Flight">
            <input
              type="number"
              min={1}
              value={form.max_in_flight ?? ""}
              onChange={(e) =>
                setField("max_in_flight", e.target.value ? Number(e.target.value) : null)
              }
              className="input"
              placeholder="50"
            />
          </Field>
          <div />
          <Field label="Validation Schema (JSON Schema)">
            <textarea
              value={form.validation_schema_json || ""}
              onChange={(e) => setField("validation_schema_json", e.target.value)}
              className="input font-mono text-sm"
              rows={4}
              placeholder='{"type": "object", "required": ["name"]}'
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-secondary-third">
          Outbound signing to the registry uses the connector service key
          (`CONNECTOR_SIGNING_*` env). Configure that on the service, not per pipeline.
        </p>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-neutral-second border-t border-primary-second shadow-lg z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-end gap-3">
          <button type="button" onClick={() => navigate("/")} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Create Pipeline"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-first">
        {label}
        {required && <span className="text-toast-failed ml-0.5">*</span>}
      </span>
      {hint && <p className="text-xs text-secondary-third mt-0.5 mb-1">{hint}</p>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function MetadataSelectOrInput({
  value,
  onChange,
  source,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  source: MetadataList | null;
  placeholder: string;
  required?: boolean;
}) {
  const hasDropdown = !!source?.configured && (source?.items.length ?? 0) > 0;

  if (!hasDropdown) {
    return (
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        placeholder={placeholder}
      />
    );
  }

  const items = source!.items;
  const knownValues = new Set(items.map((i) => i.value));
  const showStrayOption = value && !knownValues.has(value);

  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
    >
      <option value="">Select…</option>
      {showStrayOption && (
        <option value={value}>{value} (not in registry)</option>
      )}
      {items.map((it) => (
        <option key={it.value} value={it.value}>
          {it.label}
        </option>
      ))}
    </select>
  );
}
