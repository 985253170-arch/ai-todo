"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { AuthScreen } from "@/types/app";
import { IconMail, IconStar } from "@/components/icons";
import { useBackController } from "@/contexts/BackControllerContext";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextInput } from "@/components/ui/TextInput";

interface OtpLoginPageProps {
  onNavigate: (screen: AuthScreen) => void;
  onLoginSuccess: () => void;
}

type OtpStep = "email-entry" | "code-entry";

function validateEmail(email: string): string {
  if (!email.trim()) {
    return "先写下邮箱地址。";
  }

  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return "邮箱地址好像不太对。";
  }

  return "";
}

function maskEmail(email: string): string {
  const [localPart, domain, ...rest] = email.trim().split("@");

  if (!localPart || !domain || rest.length > 0) {
    return "你的演示邮箱";
  }

  if (localPart.length === 1) {
    return `*@${domain}`;
  }

  if (localPart.length === 2) {
    return `${localPart[0]}*@${domain}`;
  }

  return `${localPart[0]}${"*".repeat(Math.max(1, localPart.length - 2))}${localPart.at(-1)}@${domain}`;
}

export function OtpLoginPage({ onNavigate, onLoginSuccess }: OtpLoginPageProps) {
  const [otpStep, setOtpStep] = useState<OtpStep>("email-entry");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isCodeInputFocused, setIsCodeInputFocused] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backController = useBackController();

  const clearSendTimeout = useCallback(() => {
    if (sendTimeoutRef.current !== null) {
      clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }
  }, []);

  const returnToEmailEntry = useCallback(() => {
    clearSendTimeout();
    setIsSending(false);
    setOtpStep("email-entry");
    setVerificationCode("");
    setResendTimer(0);
    setFormError("");
    setEmailError("");
    setIsCodeInputFocused(false);
  }, [clearSendTimeout]);

  useEffect(() => {
    return () => clearSendTimeout();
  }, [clearSendTimeout]);

  useEffect(() => {
    if (otpStep !== "code-entry" || resendTimer <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setResendTimer((currentTimer) => Math.max(0, currentTimer - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [otpStep, resendTimer]);

  useEffect(() => {
    backController.register({
      id: "otp-code-entry",
      priority: 65,
      handle: () => {
        if (otpStep !== "code-entry") {
          return false;
        }

        returnToEmailEntry();
        return true;
      },
    });

    return () => backController.unregister("otp-code-entry");
  }, [backController, otpStep, returnToEmailEntry]);

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError("");

    if (nextEmailError || isSending) {
      return;
    }

    setIsSending(true);
    clearSendTimeout();
    sendTimeoutRef.current = setTimeout(() => {
      sendTimeoutRef.current = null;
      setOtpStep("code-entry");
      setVerificationCode("");
      setResendTimer(60);
      setIsSending(false);
      setIsCodeInputFocused(false);
    }, 250);
  }

  function handleVerificationCodeChange(value: string) {
    setVerificationCode(value.replace(/\D/g, "").slice(0, 6));
    if (formError) {
      setFormError("");
    }
  }

  function handleVerifyCode() {
    if (!/^\d{6}$/.test(verificationCode)) {
      setFormError("验证码需要 6 位。");
      return;
    }

    setFormError("");
    onLoginSuccess();
  }

  function handleResend() {
    setFormError("");
    setResendTimer(60);
  }

  function renderEmailEntry() {
    return (
      <>
        <header className="shrink-0">
          <p className="font-serif text-3xl font-semibold text-brand-blue">清行</p>
          <div className="mt-7 flex items-start justify-between gap-5">
            <div>
              <h1 className="font-serif text-4xl font-semibold leading-tight text-brand-blue">
                今天，也从一小步开始
              </h1>
              <p className="mt-3 text-base leading-7 text-text-secondary">
                登录后，昨天的行动还会在这里。
              </p>
            </div>
            <div className="mt-1 shrink-0 text-brand-blue">
              <IconStar size={30} />
            </div>
          </div>
        </header>

        <PaperCard variant="warm" padding="large" className="mt-7 shrink-0">
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

          <form className="space-y-5" onSubmit={handleEmailSubmit}>
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
            <PrimaryButton
              loading={isSending}
              loadingText="正在准备验证码..."
              type="submit"
            >
              发送验证码
            </PrimaryButton>
          </form>
        </PaperCard>

        <footer className="shrink-0 pt-5 text-center text-sm leading-6 text-text-secondary">
          第一次来？
          <button
            className="font-semibold text-brand-blue"
            type="button"
            onClick={() => onNavigate("register")}
          >
            创建我的行动记录
          </button>
        </footer>
      </>
    );
  }

  function renderCodeEntry() {
    const activeIndex = Math.min(verificationCode.length, 5);

    return (
      <>
        <header className="shrink-0">
          <p className="font-serif text-3xl font-semibold text-brand-blue">清行</p>
          <h1 className="mt-7 font-serif text-4xl font-semibold leading-tight text-brand-blue">
            继续输入验证码
          </h1>
          <p className="mt-3 text-base leading-7 text-text-secondary">
            当前是前端体验流程，暂时不会发送真实邮件。
            <br />
            输入任意 6 位数字即可继续体验。
          </p>
        </header>

        <PaperCard variant="warm" padding="large" className="mt-7 shrink-0">
          <div className="flex items-center gap-3">
            <span className="grid min-h-touch min-w-touch place-items-center rounded-input bg-paper text-brand-blue">
              <IconMail size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-blue">演示邮箱</p>
              <p className="truncate text-sm leading-6 text-text-secondary">{maskEmail(email)}</p>
            </div>
          </div>

          <div
            className="relative mt-6 cursor-text"
            onClick={() => codeInputRef.current?.focus()}
          >
            <input
              ref={codeInputRef}
              aria-label="6 位验证码"
              autoComplete="one-time-code"
              className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
              inputMode="numeric"
              maxLength={6}
              onBlur={() => setIsCodeInputFocused(false)}
              onChange={(event) => handleVerificationCodeChange(event.target.value)}
              onFocus={() => setIsCodeInputFocused(true)}
              type="text"
              value={verificationCode}
            />
            <div className="pointer-events-none grid grid-cols-6 gap-2" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => {
                const isActive = isCodeInputFocused && index === activeIndex;
                const digit = verificationCode[index] ?? "";

                return (
                  <span
                    className={[
                      "grid min-h-touch place-items-center rounded-input border bg-paper text-xl font-semibold text-brand-blue shadow-inner",
                      isActive ? "border-brand-blue" : "border-border-paper",
                    ].join(" ")}
                    key={index}
                  >
                    {digit}
                  </span>
                );
              })}
            </div>
          </div>

          {formError ? <p className="mt-3 px-2 text-sm text-danger-soft">{formError}</p> : null}

          <div className="mt-6 space-y-3">
            <PrimaryButton
              disabled={verificationCode.length !== 6}
              onClick={handleVerifyCode}
              type="button"
            >
              验证并进入清行
            </PrimaryButton>
            <button
              className="min-h-touch w-full rounded-button px-4 text-sm font-semibold text-brand-blue disabled:text-text-tertiary"
              disabled={resendTimer > 0}
              type="button"
              onClick={handleResend}
            >
              {resendTimer > 0 ? `重新发送（${resendTimer} 秒）` : "重新发送"}
            </button>
            <button
              className="min-h-touch w-full rounded-button px-4 text-sm font-semibold text-text-secondary"
              type="button"
              onClick={returnToEmailEntry}
            >
              更换邮箱
            </button>
          </div>
        </PaperCard>
      </>
    );
  }

  return (
    <main className="flex h-full min-h-0 flex-col bg-warm-bg px-6 py-7">
      <div className="mx-auto flex w-full max-w-mobile flex-col">
        {otpStep === "email-entry" ? renderEmailEntry() : renderCodeEntry()}
      </div>
    </main>
  );
}
