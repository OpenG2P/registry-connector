/** Treat naive ISO timestamps from the API as UTC. */
export function parseUtcTimestamp(
  timestamp: string | null | undefined
): Date | null {
  if (!timestamp) return null;
  const trimmed = timestamp.trim();
  if (!trimmed) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = hasZone ? trimmed : `${trimmed}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocal(timestamp: string | null | undefined): string {
  const date = parseUtcTimestamp(timestamp);
  return date ? date.toLocaleString() : "—";
}

export function formatRelativeTime(
  timestamp: string | null | undefined
): string {
  const date = parseUtcTimestamp(timestamp);
  if (!date) return "—";
  const differenceSeconds = (date.getTime() - Date.now()) / 1000;
  const absoluteSeconds = Math.abs(differenceSeconds);
  const unit =
    absoluteSeconds < 60
      ? `${Math.round(absoluteSeconds)}s`
      : absoluteSeconds < 3600
        ? `${Math.round(absoluteSeconds / 60)}m`
        : absoluteSeconds < 86400
          ? `${Math.round(absoluteSeconds / 3600)}h`
          : `${Math.round(absoluteSeconds / 86400)}d`;
  return differenceSeconds >= 0 ? `in ${unit}` : `${unit} ago`;
}
