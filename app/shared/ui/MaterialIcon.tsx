/**
 * @module MaterialIcon
 * @description Material Symbols icon. Réplica del componente .astro legacy.
 *
 * @param icon - Material Symbols icon name (e.g. "home", "logout")
 * @param color - CSS color value or "currentColor" (default)
 * @param style - Tailwind extra classes
 * @param variant - outlined (default) | filled | rounded | sharp | two-tone
 */
import type { CSSProperties } from "react";

type Variant = "outlined" | "filled" | "rounded" | "sharp" | "two-tone";

type Props = {
  icon: string;
  color?: string;
  style?: string;
  variant?: Variant;
};

export default function MaterialIcon({
  icon,
  color = "currentColor",
  style = "",
  variant = "outlined",
}: Props) {
  const inlineStyle: CSSProperties =
    color === "currentColor" ? {} : { color };
  return (
    <span
      className={`material-symbols-${variant} ${style}`.trim()}
      style={inlineStyle}
      aria-hidden
    >
      {icon}
    </span>
  );
}
