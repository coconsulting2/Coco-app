/**
 * @module MetricCard
 * @description Metric card for dashboard KPIs — "newspaper grid" style con
 * bordes de 1px que se unen. Money values en Fraunces serif con tabular-nums.
 */

type Variant = "default" | "positive" | "negative";
type Position = "first" | "middle" | "last" | "solo";

type Props = {
  label: string;
  value: string;
  detail?: string;
  variant?: Variant;
  isMoney?: boolean;
  position?: Position;
};

const VALUE_COLOR: Record<Variant, string> = {
  default: "text-[var(--color-ink)]",
  positive: "text-[var(--color-success-500)]",
  negative: "text-[var(--color-accent-400)]",
};

const BORDER: Record<Position, string> = {
  first: "rounded-l-[var(--radius-lg)] rounded-r-none border-r-0",
  middle: "rounded-none border-r-0",
  last: "rounded-r-[var(--radius-lg)] rounded-l-none",
  solo: "rounded-[var(--radius-lg)]",
};

export default function MetricCard({
  label,
  value,
  detail,
  variant = "default",
  isMoney = false,
  position = "solo",
}: Props) {
  return (
    <div
      className={`bg-[var(--color-surface-white)] border border-[var(--color-neutral-200)] px-5 py-4 ${BORDER[position]}`}
    >
      <p className="eyebrow mb-1">{label}</p>
      <p
        className={`text-2xl font-light leading-tight ${VALUE_COLOR[variant]} ${
          isMoney ? "money-display" : "font-editorial"
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{detail}</p>}
    </div>
  );
}
