import { iconColor, type IconProps } from "./iconTypes";

export function IconMe({ size = 28, active = false, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.1 6.3c2.4.1 4 1.8 3.9 4.1-.1 2.2-1.7 3.8-4 3.7-2.3-.1-3.8-1.7-3.8-4 .1-2.2 1.7-3.8 3.9-3.8Z" />
      <path d="M7.2 22.1c.8-3.9 3.1-5.8 6.8-5.8 3.8 0 6.2 2 7 5.8" />
      <path d="M9.2 22.8c3.1.6 6.4.6 9.6 0" />
    </svg>
  );
}
