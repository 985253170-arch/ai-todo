import { iconColor, type IconProps } from "./iconTypes";

export function IconLock({
  size = 28,
  active = true,
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke={iconColor(active)}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.2 12.8c3.6-.5 7.8-.5 11.6.1.7.1 1.2.7 1.3 1.4.2 2.3.1 4.5-.2 6.6-.1.8-.7 1.4-1.5 1.5-3.6.4-7.3.4-10.9 0-.8-.1-1.3-.7-1.5-1.5-.3-2.1-.3-4.3.1-6.7.1-.7.5-1.2 1.1-1.4Z" />
      <path d="M10.2 12.4c-.1-1.7.2-3.2 1.1-4.5.8-1.2 1.9-1.9 3.3-1.9 1.5.1 2.6.8 3.2 2 .7 1.3.9 2.8.6 4.5" />
      <path d="M14 16.2c.7.1 1.1.5 1.1 1.2 0 .5-.3.9-.8 1.1v1.6" />
    </svg>
  );
}
