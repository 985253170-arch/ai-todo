import { UI_TEXT } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="space-y-4">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
        {UI_TEXT.APP_NAME}
      </h1>
      <p className="max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
        {UI_TEXT.APP_TAGLINE}
      </p>
    </section>
  );
}
