import { UI_TEXT } from "@/lib/constants";

export function Header() {
  return (
    <header className="mb-6 flex items-center justify-between pt-[env(safe-area-inset-top,0px)] sm:mb-8">
      <div className="flex items-center gap-3">
        <p className="border-l-2 border-indigo-500 pl-3 text-xl font-semibold tracking-tight text-slate-950">
          {UI_TEXT.APP_NAME}
        </p>
        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {UI_TEXT.APP_ROLE}
        </span>
      </div>
    </header>
  );
}
