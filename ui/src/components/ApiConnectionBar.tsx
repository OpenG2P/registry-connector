import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Wifi } from "lucide-react"
import { connectorApiTargetLabel } from "../lib/api-target"

type Status = "checking" | "ok" | "error"

export default function ApiConnectionBar() {
  const target = connectorApiTargetLabel()
  const [status, setStatus] = useState<Status>("checking")
  const [detail, setDetail] = useState("")

  const check = async () => {
    setStatus("checking")
    setDetail("")
    try {
      const res = await fetch("/health", { signal: AbortSignal.timeout(12_000) })
      if (!res.ok) {
        setStatus("error")
        setDetail(`${res.status} ${res.statusText}`)
        return
      }
      const body = (await res.json()) as { status?: string }
      if (body.status === "ok") {
        setStatus("ok")
      } else {
        setStatus("error")
        setDetail(JSON.stringify(body))
      }
    } catch (e) {
      setStatus("error")
      const msg = e instanceof Error ? e.message : String(e)
      setDetail(msg === "Failed to fetch" ? "unreachable" : msg)
    }
  }

  useEffect(() => {
    void check()
    const id = window.setInterval(() => void check(), 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className={`flex flex-wrap items-center gap-2 px-4 py-2 text-sm border-b ${
        status === "ok"
          ? "bg-toast-success/15 border-toast-success/40 text-neutral-first"
          : status === "checking"
            ? "bg-primary-first/20 border-primary-second text-neutral-first"
            : "bg-toast-failed/10 border-toast-failed/40 text-toast-failed"
      }`}
    >
      {status === "checking" ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : status === "ok" ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-toast-success" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      <Wifi className="w-4 h-4 shrink-0 opacity-70" />
      <span className="font-medium">API:</span>
      <code className="text-xs bg-neutral-second/80 px-1.5 py-0.5 rounded-[10px]">{target}</code>
      {status === "ok" && <span className="text-toast-success">connected</span>}
      {status === "error" && (
        <span>
          not reachable
          {detail ? ` (${detail})` : ""}
          {" — "}
          connect <strong>UD</strong> or <strong>EDRMC</strong> WireGuard, then{" "}
          <code className="text-xs">npm run dev</code>
        </span>
      )}
      <button
        type="button"
        onClick={() => void check()}
        className="ml-auto text-xs underline hover:no-underline"
      >
        Retry
      </button>
    </div>
  )
}
