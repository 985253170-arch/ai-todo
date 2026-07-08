import { iconColor, type IconProps } from "./iconTypes";

export function IconToday({ size = 28, active = false, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 6.8c3.7-.6 8.4-.5 12.7.2.7.1 1.2.7 1.3 1.4.4 3.6.3 7.4-.2 11.1-.1.8-.8 1.4-1.6 1.5-4 .5-8.1.5-12.1-.1-.8-.1-1.4-.8-1.5-1.6-.3-3.5-.2-7.1.2-10.7.1-.9.5-1.5 1.2-1.8Z" />
      <path d="M9.2 5.1v4.1M18.6 5.2v4" />
      <path d="M9.5 13.1c2.7-.4 5.7-.4 9 .1M10 17.1c1.6-.2 3.3-.1 5.1.1" />
    </svg>
  );
}
