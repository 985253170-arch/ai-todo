export interface IconProps {
  size?: number;
  active?: boolean;
  className?: string;
}

export function iconColor(active = false): string {
  return active ? "#0F3155" : "#8C887E";
}
