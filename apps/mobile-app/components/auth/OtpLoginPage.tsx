"use client";

import { useState, type FormEvent } from "react";
import type { AuthScreen } from "@/types/app";
import { IconMail, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextInput } from "@/components/ui/TextInput";
import { loginWithOtp } from "@/services/authService.mock";

interface OtpLoginPageProps {
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

export function OtpLoginPage({ onNavigate, onLoginSuccess }: OtpLoginPageProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError("");

    if (nextEmailError) {
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithOtp(email.trim());
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
        <header>
          <p className="font-serif text-3xl font-semibold text-brand-blue">清行</p>
          <div className="mt-8 flex items-start justify-between gap-5">
            <div>
              <h1 className="font-serif text-4xl font-semibold leading-tight text-brand-blue">
                今天，也从一小步开始
              </h1>
              <p className="mt-4 text-base leading-7 text-text-secondary">
                登录后，昨天的行动还会在这里。
              </p>
            </div>
            <div className="mt-1 shrink-0 text-brand-blue">
              <IconStar size={30} />
            </div>
          </div>
        </header>

        <PaperCard variant="warm" padding="large">
          <div className="mb-6">
            <h2 className="font-serif text-2xl font-semibold text-brand-blue">继续今天的小步</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              把行动记录留下来，下次还能接着走。
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-button bg-warm-soft p-1 text-sm font-semibold">
            <button className="min-h-touch rounded-button bg-brand-blue text-white" type="button">
              验证码登录
            </button>
            <button
              className="min-h-touch rounded-button text-brand-blue"
              type="button"
              onClick={() => onNavigate("password-login")}
            >
              密码登录
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <p className="text-sm leading-6 text-text-secondary">
              收一封邮件，就可以继续今天的记录。
            </p>
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
              placeholder="电子邮件"
              type="email"
              value={email}
            />
            {formError ? <p className="px-2 text-sm text-danger-soft">{formError}</p> : null}
            <PrimaryButton loading={isSubmitting} loadingText="正在登录..." type="submit">
              进入我的行动手账
            </PrimaryButton>
          </form>
        </PaperCard>

        <footer className="text-center text-sm leading-6 text-text-secondary">
          第一次来？
          <button
            className="font-semibold text-brand-blue"
            type="button"
            onClick={() => onNavigate("register")}
          >
            创建我的行动记录
          </button>
        </footer>
      </div>
    </main>
  );
}
