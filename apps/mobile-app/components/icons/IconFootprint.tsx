import { iconColor, type IconProps } from "./iconTypes";

export function IconFootprint({ size = 28, active = false, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={iconColor(active)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 15.4c1.7.2 2.9 1.9 2.6 3.8-.3 1.8-1.7 3-3.2 2.8-1.7-.2-2.8-1.9-2.5-3.8.2-1.8 1.6-3 3.1-2.8Z" />
      <path d="M18.4 11.8c1.6.3 2.6 1.9 2.3 3.6-.3 1.8-1.7 2.9-3.1 2.7-1.6-.3-2.5-1.9-2.2-3.6.3-1.7 1.6-2.9 3-2.7Z" />
      <path d="M8.2 11.2c.4-.8 1.1-1.2 1.8-.9.6.3.8 1.1.4 1.8-.4.8-1.1 1.2-1.7.9-.7-.3-.9-1-.5-1.8Z" />
      <path d="M13 9.3c.5-.8 1.3-1.1 1.9-.7.6.4.7 1.2.2 1.9-.5.8-1.3 1.1-1.9.7-.6-.4-.7-1.2-.2-1.9Z" />
      <path d="M19.5 7.1c.6-.6 1.4-.7 1.9-.2.5.5.4 1.3-.2 1.9-.6.6-1.4.7-1.9.2-.5-.5-.4-1.3.2-1.9Z" />
    </svg>
  );
}
