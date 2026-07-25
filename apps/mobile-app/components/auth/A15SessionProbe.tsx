"use client";

import { useEffect, useRef, useState } from "react";
import type { AuthResult, AuthStatus, AuthSessionEventType, OtpIntent, SendRecoveryOtpInput, RecoveryOtpDelivery } from "@/types/app";

type AuthMeMatch = "null" | "match" | "mismatch" | "request-error" | "未检查";
type HarnessScenario = Exclude<AuthSessionEventType, "INITIAL_SESSION"> | "delayed-initialization";

type A15SessionProbeProps = {
  authStatus: AuthStatus;
  maskedEmail: string | null;
  truncatedUserId: string | null;
  isCurrentUserId: (userId: string) => boolean;
  appShellAllowed: boolean;
  recoveryLockActive: boolean;
  lastEventType: AuthSessionEventType | null;
  lateInitializationDiscarded: boolean;
  signOutCallCount: number;
  operationInProgress: boolean;
  onSendOtp: (email: string, intent: OtpIntent) => Promise<AuthResult<void>>;
  onVerifyOtp: (email: string, code: string, intent: OtpIntent) => Promise<AuthResult<unknown>>;
  onSignOut: () => Promise<AuthResult<void>>;
  onRunHarness: (scenario: HarnessScenario) => void;
  onSendRecoveryOtp: (input: SendRecoveryOtpInput) => Promise<AuthResult<RecoveryOtpDelivery>>;
};

function maskEmail(email: string) {
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export function A15SessionProbe({
  ...props
}: A15SessionProbeProps) {
  if (process.env.NODE_ENV !== "development") return null;
  return <A15SessionProbeDevelopment {...props} />;
}

function A15SessionProbeDevelopment({
  authStatus,
  maskedEmail,
  truncatedUserId,
  isCurrentUserId,
  appShellAllowed,
  recoveryLockActive,
  lastEventType,
  lateInitializationDiscarded,
  signOutCallCount,
  operationInProgress,
  onSendOtp,
  onVerifyOtp,
  onSignOut,
  onRunHarness,
  onSendRecoveryOtp,
}: A15SessionProbeProps) {
  const [intent, setIntent] = useState<OtpIntent>("sign-in");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("仅使用专用 Development 测试邮箱。");
  const [authMeMatch, setAuthMeMatch] = useState<AuthMeMatch>("未检查");
  const mountedRef = useRef(true);
  const operationEpochRef = useRef(0);
  const inputRef = useRef({ email: "", intent: "sign-in" as OtpIntent });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationEpochRef.current += 1;
    };
  }, []);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const beginOperation = () => {
    operationEpochRef.current += 1;
    return operationEpochRef.current;
  };
  const invalidateOperations = () => {
    operationEpochRef.current += 1;
  };
  const ownsOperation = (epoch: number, capturedEmail?: string, capturedIntent?: OtpIntent) => {
    return mountedRef.current &&
      operationEpochRef.current === epoch &&
      (capturedEmail === undefined || normalizeEmail(inputRef.current.email) === capturedEmail) &&
      (capturedIntent === undefined || inputRef.current.intent === capturedIntent);
  };

  const clearForEmailChange = (nextEmail: string) => {
    invalidateOperations();
    inputRef.current.email = nextEmail;
    setEmail(nextEmail);
    setOtp("");
    setSent(false);
    setFeedback("仅使用专用 Development 测试邮箱。");
    setAuthMeMatch("未检查");
  };

  const clearForIntentChange = (nextIntent: OtpIntent) => {
    invalidateOperations();
    inputRef.current.intent = nextIntent;
    setIntent(nextIntent);
    setOtp("");
    setSent(false);
    setFeedback("仅使用专用 Development 测试邮箱。");
    setAuthMeMatch("未检查");
  };

  const sendOtp = async () => {
    const capturedEmail = normalizeEmail(email);
    const capturedIntent = intent;
    if (!capturedEmail) {
      setFeedback("请输入专用 Development 测试邮箱。");
      return;
    }
    const epoch = beginOperation();
    setBusy(true);
    let result: AuthResult<void>;
    try {
      result = await onSendOtp(capturedEmail, capturedIntent);
    } catch {
      if (!ownsOperation(epoch, capturedEmail, capturedIntent)) return;
      setBusy(false);
      setFeedback("操作失败，请查看安全验证报告。");
      return;
    }
    if (!ownsOperation(epoch, capturedEmail, capturedIntent)) return;
    setBusy(false);
    if (!result.ok) {
      setFeedback(`操作失败：${result.error.code}`);
      return;
    }
    setSent(true);
    setFeedback("验证码已发送，请使用专用 Development 测试邮箱查收。");
  };

  const verifyOtp = async () => {
    const capturedEmail = normalizeEmail(email);
    const capturedIntent = intent;
    if (!sent || !/^\d{6}$/.test(otp) || !capturedEmail) {
      setFeedback("请输入六位数字验证码。");
      return;
    }
    const submittedOtp = otp;
    setOtp("");
    const epoch = beginOperation();
    setBusy(true);
    let result: AuthResult<unknown>;
    try {
      result = await onVerifyOtp(capturedEmail, submittedOtp, capturedIntent);
    } catch {
      if (!ownsOperation(epoch, capturedEmail, capturedIntent)) return;
      setBusy(false);
      setFeedback("操作失败，请查看安全验证报告。");
      return;
    }
    if (!ownsOperation(epoch, capturedEmail, capturedIntent)) return;
    setBusy(false);
    if (!result.ok) {
      setFeedback(`操作失败：${result.error.code}`);
      return;
    }
    inputRef.current.email = "";
    setEmail("");
    setSent(false);
    setFeedback("验证请求已完成。");
  };

  const signOut = async () => {
    invalidateOperations();
    const epoch = beginOperation();
    inputRef.current.email = "";
    setOtp("");
    setEmail("");
    setSent(false);
    setFeedback("仅使用专用 Development 测试邮箱。");
    setAuthMeMatch("未检查");
    setBusy(true);
    let result: AuthResult<void>;
    try {
      result = await onSignOut();
    } catch {
      if (!ownsOperation(epoch)) return;
      setBusy(false);
      setFeedback("操作失败，请查看安全验证报告。");
      return;
    }
    if (!ownsOperation(epoch)) return;
    setBusy(false);
    setFeedback(result.ok ? "仅使用专用 Development 测试邮箱。" : `操作失败：${result.error.code}`);
  };

  const requestRecovery = async () => {
    const capturedEmail = normalizeEmail(email);
    if (!capturedEmail) {
      setFeedback("请输入专用 Development 测试邮箱。");
      return;
    }
    const epoch = beginOperation();
    setBusy(true);
    try {
      const result = await onSendRecoveryOtp({ email: capturedEmail });
      if (!ownsOperation(epoch, capturedEmail)) return;
      setBusy(false);
      setFeedback(result.ok ? "恢复邮件请求已提交，请在同一浏览器中完成后续验证。" : `操作失败：${result.error.code}`);
    } catch {
      if (!ownsOperation(epoch, capturedEmail)) return;
      setBusy(false);
      setFeedback("操作失败，请查看安全验证报告。");
    }
  };

  const checkAuthMe = async () => {
    const capturedEmail = normalizeEmail(email);
    const capturedIntent = intent;
    const epoch = beginOperation();
    setBusy(true);
    try {
      const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      if (!ownsOperation(epoch, capturedEmail, capturedIntent)) return;
      if (!response.ok) {
        setBusy(false);
        setAuthMeMatch("request-error");
        return;
      }
      const body: unknown = await response.json();
      if (!ownsOperation(epoch, capturedEmail, capturedIntent)) return;
      const remoteUser = body && typeof body === "object" && "user" in body
        ? (body as { user?: unknown }).user
        : undefined;
      if (remoteUser === null) {
        setBusy(false);
        setAuthMeMatch("null");
        return;
      }
      const remoteUserId = remoteUser && typeof remoteUser === "object" && "id" in remoteUser
        ? (remoteUser as { id?: unknown }).id
        : undefined;
      setAuthMeMatch(typeof remoteUserId === "string" && isCurrentUserId(remoteUserId)
        ? "match"
        : "mismatch");
      setBusy(false);
    } catch {
      if (!ownsOperation(epoch, capturedEmail, capturedIntent)) return;
      setBusy(false);
      setAuthMeMatch("request-error");
    }
  };

  const disableActions = busy || operationInProgress;

  return (
    <aside className="fixed bottom-3 right-3 z-50 max-h-[calc(100vh-1.5rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-800 shadow-lg">
      <h2 className="font-semibold">A1.5 开发验证面板（临时）</h2>
      <p className="mt-1 text-xs text-slate-600">仅用于 Development Auth 验证，完成后删除，不进入提交。</p>

      <label className="mt-3 block text-xs font-medium" htmlFor="a15-intent">OTP 意图</label>
      <select id="a15-intent" className="mt-1 w-full rounded border border-slate-300 p-2" value={intent} disabled={disableActions} onChange={(event) => clearForIntentChange(event.target.value as OtpIntent)}>
        <option value="sign-in">已有账号登录</option>
        <option value="sign-up">注册测试账号</option>
      </select>

      <label className="mt-3 block text-xs font-medium" htmlFor="a15-email">专用 Development 测试邮箱</label>
      <input id="a15-email" className="mt-1 w-full rounded border border-slate-300 p-2" type="email" value={email} disabled={disableActions} onChange={(event) => clearForEmailChange(event.target.value)} />
      {sent ? <p className="mt-1 text-xs text-slate-600">已发送至：{maskEmail(email)}</p> : null}

      <button className="mt-2 w-full rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50" type="button" disabled={disableActions} onClick={sendOtp}>发送六位验证码</button>

      <label className="mt-3 block text-xs font-medium" htmlFor="a15-otp">六位 OTP</label>
      <input id="a15-otp" className="mt-1 w-full rounded border border-slate-300 p-2" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={otp} disabled={disableActions} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} />
      <button className="mt-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-50" type="button" disabled={disableActions} onClick={verifyOtp}>验证六位 OTP</button>
      <button className="mt-2 w-full rounded border border-slate-300 px-3 py-2 disabled:opacity-50" type="button" disabled={disableActions} onClick={requestRecovery}>发送专用测试账号的密码恢复邮件</button>
      <button className="mt-2 w-full rounded border border-slate-300 px-3 py-2 disabled:opacity-50" type="button" disabled={disableActions} onClick={checkAuthMe}>检查同源认证状态</button>
      <button className="mt-2 w-full rounded border border-slate-300 px-3 py-2 disabled:opacity-50" type="button" disabled={disableActions} onClick={signOut}>本地退出</button>

      <p className="mt-3 rounded bg-slate-100 p-2 text-xs" aria-live="polite">{feedback}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <dt>当前状态</dt><dd>{authStatus}</dd>
        <dt>脱敏邮箱</dt><dd>{maskedEmail ?? "—"}</dd>
        <dt>截断用户 ID</dt><dd>{truncatedUserId ?? "—"}</dd>
        <dt>同源认证比对</dt><dd>{authMeMatch}</dd>
        <dt>最近事件</dt><dd>{lastEventType ?? "—"}</dd>
        <dt>操作进行中</dt><dd>{String(operationInProgress)}</dd>
        <dt>AppShell allowed</dt><dd>{String(appShellAllowed)}</dd>
        <dt>recovery lock</dt><dd>{String(recoveryLockActive)}</dd>
        <dt>late init discarded</dt><dd>{String(lateInitializationDiscarded)}</dd>
        <dt>signOut 调用次数</dt><dd>{signOutCallCount}</dd>
      </dl>

      <p className="mt-3 text-xs font-medium">Controller race harness</p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {(["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "SIGNED_OUT", "PASSWORD_RECOVERY", "delayed-initialization"] as HarnessScenario[]).map((scenario) => (
          <button className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50" type="button" disabled={disableActions} key={scenario} onClick={() => onRunHarness(scenario)}>{scenario}</button>
        ))}
      </div>
    </aside>
  );
}
