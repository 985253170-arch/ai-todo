import { iconColor, type IconProps } from "./iconTypes";

export function IconLeaf({ size = 28, active = true, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.6 18.8c.4-6.1 5.4-10.4 14.5-12.3.8 8.3-2.6 13.4-9 14.2-2 .3-3.8-.3-5.5-1.9Z" />
      <path d="M7.4 18.7c3.9-3.9 7.6-6.6 11.3-8.1" />
    </svg>
  );
}
