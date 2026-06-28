type ErrorMessageType = "error" | "warning" | "info";

interface ErrorMessageProps {
  message: string | null;
  type?: ErrorMessageType;
}

const messageStyles: Record<ErrorMessageType, string> = {
  error: "text-red-600",
  warning: "text-amber-700",
  info: "text-slate-500",
};

export function ErrorMessage({ message, type = "error" }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p className={`text-sm font-medium ${messageStyles[type]}`} role="alert">
      {message}
    </p>
  );
}
