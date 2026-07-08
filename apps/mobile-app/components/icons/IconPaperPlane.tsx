import { iconColor, type IconProps } from "./iconTypes";

export function IconPaperPlane({ size = 48, active = true, className = "" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={iconColor(active)} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.6 23.1c10.9-4.7 21-8.2 31-10.6.9-.2 1.5.7 1 1.5-5.2 7.9-9.2 14.8-12.8 22.5-.4.8-1.5.8-1.9.1l-4.7-8.2-8.9-3.4c-.9-.4-1-1.5-.1-1.9Z" />
      <path d="M20.2 28.4c4.1-4.2 8.2-8 12.9-11.1" />
      <path d="M24.9 36.6c.2-2.7.5-5.3.8-7.9" />
    </svg>
  );
}
