import { iconColor, type IconProps } from "./iconTypes";

export function IconBack({ size = 28, active = true, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.8 7.2c-2.2 2.1-4.2 4.3-6.1 6.6 1.9 2.4 3.9 4.6 6.1 6.8" />
      <path d="M11.1 13.9c3.8-.1 7.1 0 9.9.2" />
    </svg>
  );
}
