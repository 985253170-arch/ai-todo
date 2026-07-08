import { iconColor, type IconProps } from "./iconTypes";

export function IconCheck({ size = 24, active = true, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.4 12.3c1.4 1.7 2.8 3.1 4.2 4.3 2.8-3.8 5.9-6.9 9.1-9.3" />
    </svg>
  );
}
