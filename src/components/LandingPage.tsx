"use client";

import Link from "next/link";

export function LandingPage() {
  return (
    <section className="grid gap-6 rounded-3xl border border-indigo-100 bg-white/80 p-6 shadow-[0_18px_60px_rgba(79,70,229,0.08)] sm:p-8">
      <div className="grid gap-4">
        <p className="text-sm font-semibold text-indigo-700">
          AI Todo 工作台
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          把今天的目标拆成可执行任务
        </h1>
        <p className="text-base leading-7 text-slate-600">
          输入一个目标，AI 会生成当天任务、记录完成情况，并在需要时给出复盘和调整建议。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-indigo-600 px-6 text-base font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.18)] transition duration-150 hover:-translate-y-px hover:bg-indigo-700"
          href="/login"
        >
          免费开始使用
        </Link>
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-base font-semibold text-slate-700 transition duration-150 hover:border-indigo-100 hover:text-indigo-700"
          href="/login"
        >
          登录 / 注册
        </Link>
      </div>

      <div className="grid gap-3 border-t border-slate-100 pt-5 text-sm leading-6 text-slate-600 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-slate-900">登录可用</p>
          <p>登录后生成当天任务，并延续账号数据。</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">登录同步</p>
          <p>登录后任务记录会绑定账号，支持多设备同步。</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">智能调整</p>
          <p>根据历史完成情况调整任务数量和难度。</p>
        </div>
      </div>
    </section>
  );
}


