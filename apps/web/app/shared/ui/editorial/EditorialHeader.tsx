/**
 * @module EditorialHeader
 * @description Editorial page header con eyebrow + serif title + subtitle +
 * slot opcional a la derecha. Réplica del componente .astro legacy.
 */
import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export default function EditorialHeader({ eyebrow, title, subtitle, children }: Props) {
  return (
    <header className="mb-6 md:mb-8">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <div className="flex flex-col gap-3 min-w-0 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-editorial text-2xl font-normal leading-tight text-[var(--color-ink)] break-words sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--color-ink-muted)] break-words">{subtitle}</p>
          )}
        </div>
        {children && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end md:gap-3">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
