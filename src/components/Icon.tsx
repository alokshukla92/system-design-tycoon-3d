import { iconInner } from "../icons";

interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  cls?: string;
}

/** React twin of `iconSvg()` — same `<svg class="i …">` markup, rendered without a wrapper. */
export function Icon({ name, size = 16, stroke = 1.75, cls }: IconProps) {
  return (
    <svg
      className={cls ? `i ${cls}` : "i"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: iconInner(name) }}
    />
  );
}
