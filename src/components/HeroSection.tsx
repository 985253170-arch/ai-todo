import { UI_TEXT } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="space-y-3 pt-1 sm:pt-3">
      <p className="text-sm font-medium text-indigo-600">{UI_TEXT.APP_ROLE}</p>
      <h1 className="max-w-2xl text-[30px] font-bold leading-tight tracking-normal text-slate-950 sm:text-5xl">
        今天想推进哪个
        <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
          目标
        </span>
        ？
      </h1>
      <p className="max-w-xl text-[15px] leading-7 text-slate-500 sm:text-base">
        {UI_TEXT.APP_TAGLINE}
      </p>
    </section>
  );
}
