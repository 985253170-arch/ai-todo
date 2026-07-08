import { iconColor, type IconProps } from "./iconTypes";

export function IconSettings({ size = 28, active = true, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 10.1c2.2.1 3.8 1.8 3.7 4-.1 2.1-1.8 3.7-4 3.6-2.1-.1-3.7-1.8-3.6-4 .1-2 1.8-3.6 3.9-3.6Z" />
      <path d="M13.6 4.5h1.5l1 3.1 2.4 1.1 3-1.1 1 1.4-1.8 2.6.4 2.7 2.2 2.3-.8 1.6-3.1-.4-2.2 1.7-.7 3.1-1.7.2-1.5-2.8-2.6-.6-2.7 1.7-1.3-1.1 1-3-1-2.4-2.8-1.5.4-1.7 3.2-.7 1.5-2.1-.2-3.1 1.5-.8 2.4 2Z" />
    </svg>
  );
}
