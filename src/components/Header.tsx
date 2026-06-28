import { UI_TEXT } from "@/lib/constants";

export function Header() {
  return (
    <header className="mb-8 flex items-center justify-between">
      <p className="text-xl font-semibold text-slate-950">{UI_TEXT.APP_NAME}</p>
    </header>
  );
}
