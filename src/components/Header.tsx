import { UI_TEXT } from "@/lib/constants";

export function Header() {
  return (
    <header className="mb-6 flex items-center justify-between pt-[env(safe-area-inset-top,0px)] sm:mb-8">
      <p className="border-l-2 border-blue-600 pl-3 text-xl font-semibold text-slate-950">
        {UI_TEXT.APP_NAME}
      </p>
    </header>
  );
}
