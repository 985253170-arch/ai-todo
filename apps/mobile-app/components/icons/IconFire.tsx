import { iconColor, type IconProps } from "./iconTypes";

export function IconFire({ size = 28, active = true, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.8 3.8c1.2 3.8-.3 5.7-1.9 7.5-1.4 1.6-2.3 3.2-1.2 5.5" />
      <path d="M17.6 9.6c3.4 2.6 4.2 7 2 10.2-2.4 3.5-7.6 4-10.5 1.2-2.8-2.7-2.4-7.6.7-10.4" />
      <path d="M14.1 16.2c1.1 1.2 1.3 2.9.2 4.1" />
    </svg>
  );
}
