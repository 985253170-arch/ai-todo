export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto flex max-w-3xl flex-col gap-4">
        <p className="text-sm font-medium text-slate-500">AI Todo</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
          把模糊目标拆成今天可以执行的任务
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          当前为 Phase 0：项目基础工程已初始化，后续阶段再实现页面内容和交互。
        </p>
      </section>
    </main>
  );
}
