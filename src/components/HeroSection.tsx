import { UI_TEXT } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="space-y-4">
      <h1 className="max-w-3xl bg-gradient-to-r from-slate-900 to-slate-500 bg-clip-text text-4xl font-semibold tracking-normal text-transparent sm:text-5xl">
        {UI_TEXT.APP_NAME}
      </h1>
      <p className="max-w-2xl text-lg leading-8 text-slate-500 sm:text-xl">
        {UI_TEXT.APP_TAGLINE}
      </p>
    </section>
  );
}
