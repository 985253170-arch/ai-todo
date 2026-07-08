import { iconColor, type IconProps } from "./iconTypes";

export function IconStar({ size = 24, active = true, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.2 3.4c.8 2.7 1.8 4.8 3.1 6.1 1.3 1.2 3.2 1.9 5.6 2.3-2.5.8-4.3 1.7-5.5 2.9-1.2 1.2-2.1 3.1-2.8 5.8-.8-2.6-1.8-4.4-3.1-5.6-1.3-1.2-3.2-2.1-5.8-2.7 2.5-.6 4.4-1.4 5.7-2.6 1.3-1.2 2.2-3.2 2.8-6.2Z" />
    </svg>
  );
}
