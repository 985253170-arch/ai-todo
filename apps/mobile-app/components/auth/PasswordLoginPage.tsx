"use client";

import { useState, type FormEvent } from "react";
import type { AuthScreen } from "@/types/app";
import { IconLeaf, IconLock, IconMail } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextInput } from "@/components/ui/TextInput";
import { loginWithPassword } from "@/services/authService.mock";

interface PasswordLoginPageProps {
  onNavigate: (screen: AuthScreen) => void;
  onLoginSuccess: () => void;
}

function validateEmail(email: string): string {
  if (!email.trim()) {
    return "先写下邮箱地址。";
  }

  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return "邮箱地址好像不太对。";
  }

  return "";
}

export function PasswordLoginPage({
  onNavigate,
  onLoginSuccess,
}: PasswordLoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmailError = validateEmail(email);
    const nextPasswordError = password.trim() ? "" : "先写下密码。";
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError("");

    if (nextEmailError || nextPasswordError) {
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithPassword(email.trim(), password);
      onLoginSuccess();
    } catch {
      setFormError("暂时没能进入，稍后再试一次。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-warm-bg px-6 py-7">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-mobile flex-col justify-center gap-7">
        <header className="relative">
          <div className="absolute right-2 top-0 text-brand-blue/80">
            <IconLeaf size={34} />
          </div>
          <p className="font-serif text-3xl font-semibold text-brand-blue">清行</p>
          <h1 className="mt-8 pr-12 font-serif text-4xl font-semibold leading-tight text-brand-blue">
            开始留下行动足迹
          </h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            不用一次完成很多，先保存今天这一小步。
          </p>
        </header>

        <PaperCard variant="warm" padding="large">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <TextInput
              autoComplete="email"
              error={emailError}
              icon={<IconMail size={22} />}
              inputMode="email"
              onChange={(value) => {
                setEmail(value);
                if (emailError) {
                  setEmailError("");
                }
              }}
              placeholder="邮箱地址"
              type="email"
              value={email}
            />
            <TextInput
              autoComplete="current-password"
              error={passwordError}
              icon={<IconLock size={22} />}
              onChange={(value) => {
                setPassword(value);
                if (passwordError) {
                  setPasswordError("");
                }
              }}
              placeholder="输入密码"
              type="password"
              value={password}
            />
            {formError ? <p className="px-2 text-sm text-danger-soft">{formError}</p> : null}
            <PrimaryButton loading={isSubmitting} loadingText="正在进入..." type="submit">
              开始我的行动记录
            </PrimaryButton>
          </form>
        </PaperCard>

        <footer className="text-center text-sm leading-6 text-text-secondary">
          没有行动记录？
          <button
            className="font-semibold text-brand-blue"
            type="button"
            onClick={() => onNavigate("otp-login")}
          >
            直接回来
          </button>
        </footer>
      </div>
    </main>
  );
}
