interface Props {
  enabled: boolean;
  paused: boolean;
}

export default function StatusBadge({ enabled, paused }: Props) {
  if (!enabled)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-xs font-medium bg-secondary-second text-secondary-third">
        Disabled
      </span>
    );
  if (paused)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-xs font-medium bg-toast-warning/30 text-neutral-first">
        Paused
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-xs font-medium bg-toast-success/20 text-toast-success">
      Active
    </span>
  );
}
