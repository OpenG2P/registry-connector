import type { ReactNode } from "react";

interface Props {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, subtitle, children, className = "" }: Props) {
  return (
    <section
      className={`bg-neutral-second rounded-[10px] border border-dashed border-primary-second shadow-sm ${className}`}
    >
      {title && (
        <div className="px-5 py-3 border-b border-dashed border-primary-first/40">
          <h2 className="text-sm font-semibold text-primary-second uppercase tracking-wide">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-secondary-third normal-case tracking-normal">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
