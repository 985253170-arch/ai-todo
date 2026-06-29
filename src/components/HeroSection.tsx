import { UI_TEXT } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="space-y-4 pt-2 sm:pt-4">
      <p className="text-sm font-medium text-indigo-600">{UI_TEXT.APP_ROLE}</p>
      <h1 className="max-w-3xl bg-gradient-to-r from-slate-950 via-indigo-700 to-sky-600 bg-clip-text text-4xl font-semibold tracking-normal text-transparent sm:text-6xl">
        {UI_TEXT.HERO_TITLE}
      </h1>
      <p className="max-w-2xl text-lg leading-8 text-slate-500 sm:text-xl">
        {UI_TEXT.APP_TAGLINE}
      </p>
    </section>
  );
}
