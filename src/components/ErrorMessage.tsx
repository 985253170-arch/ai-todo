type ErrorMessageType = "error" | "warning" | "info";

interface ErrorMessageProps {
  message: string | null;
  type?: ErrorMessageType;
}

const messageStyles: Record<ErrorMessageType, string> = {
  error: "border-l-red-500 bg-red-50 text-red-700",
  warning: "border-l-amber-500 bg-amber-50 text-amber-800",
  info: "border-l-slate-400 bg-slate-50 text-slate-600",
};

export function ErrorMessage({ message, type = "error" }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={`rounded-md border-l-2 px-3 py-2 text-sm font-medium ${messageStyles[type]}`}
      role="alert"
    >
      {message}
    </p>
  );
}
