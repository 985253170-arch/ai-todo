import { iconColor, type IconProps } from "./iconTypes";

export function IconGrowth({ size = 28, active = false, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 22.2c.1-4.8.1-8.2.2-11.8" />
      <path d="M14.2 13.5c-3.4-.1-5.9-1.8-7-4.7 3.3-.8 5.8.5 7 4.7Z" />
      <path d="M14.4 11.2c2.8-2.9 5.7-3.8 8.2-2.4-1.2 3.1-4.1 4.2-8.2 2.4Z" />
      <path d="M8 22.3c4.1.6 8.4.6 12.2 0" />
    </svg>
  );
}
