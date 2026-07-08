import { iconColor, type IconProps } from "./iconTypes";

export function IconMail({
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
      <path d="M6.2 8.4c4.9-.6 10.2-.5 15.5.2.7.1 1.2.6 1.3 1.3.4 2.9.4 5.9-.1 8.8-.1.8-.8 1.4-1.6 1.5-4.8.5-9.9.5-14.6-.1-.8-.1-1.4-.7-1.5-1.5-.4-2.9-.4-5.8.1-8.8.1-.7.4-1.2.9-1.4Z" />
      <path d="M7.6 10.5c1.9 1.5 3.9 3 6.2 4.5 2.5-1.5 4.7-3 6.8-4.6" />
      <path d="M8 18.1c1.4-1.2 2.6-2.3 3.7-3.4M19.7 18.2c-1.1-1.1-2.3-2.2-3.5-3.2" />
    </svg>
  );
}
