import { iconColor, type IconProps } from "./iconTypes";

export function IconSeed({ size = 28, active = true, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 23c0-3.5.1-6.7.1-9.8" />
      <path d="M14.1 15.1c-2.7-.2-4.8-1.5-6-3.9 2.8-.7 4.9.5 6 3.9Z" />
      <path d="M14.2 12.6c2-2.5 4.3-3.4 6.6-2.6-.9 2.6-3.2 3.5-6.6 2.6Z" />
      <path d="M10.1 23.5c2.5.4 5.2.4 7.9 0" />
    </svg>
  );
}
