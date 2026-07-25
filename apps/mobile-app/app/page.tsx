"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
/* A1_5_PROBE_START */
import { A15SessionProbe } from "@/components/auth/A15SessionProbe";
/* A1_5_PROBE_END */
import { BackControllerProvider, useBackController } from "@/contexts/BackControllerContext";
import { WelcomePage } from "@/components/auth/WelcomePage";
import { OtpLoginPage } from "@/components/auth/OtpLoginPage";
import { PasswordLoginPage } from "@/components/auth/PasswordLoginPage";
import { RegisterPage } from "@/components/auth/RegisterPage";
import { FootprintsView } from "@/components/footprints/FootprintsView";
import { GrowthView } from "@/components/growth/GrowthView";
import { MeView } from "@/components/me/MeView";
import { AppShell } from "@/components/shell/AppShell";
import { TaskExecutionView } from "@/components/today/TaskExecutionView";
import { ActionListView } from "@/components/today/ActionListView";
import { TaskListView } from "@/components/today/TaskListView";
import { TodayHomeView } from "@/components/today/TodayHomeView";
import { completeTask, generateTasks, getTodayState } from "@/services/taskService.mock";
import { getAuthFacade } from "@/services/authService";
import type { AppTab, AuthError, AuthResult, AuthScreen, AuthSessionEvent, AuthState, AuthUser, TodayState } from "@/types/app";
type TodayMode = "home" | "tasks" | "action-list" | "execution";
type A15HarnessScenario = Exclude<AuthSessionEvent["type"], "INITIAL_SESSION"> | "delayed-initialization";
type RecoveryEpochStatus = "idle" | "active" | "failed" | "completed";
type RecoveryOperation = {
  epochId: number;
  requestId: number;
  promise: Promise<AuthResult<void>>;
  status: "pending" | "succeeded" | "failed";
  settledResult: "success" | "failure" | null;
};
type RecoveryEpoch = {
  epochId: number;
  status: RecoveryEpochStatus;
  activeRequestId: number | null;
  observedSignedOut: boolean;
  consumed: boolean;
};
type PasswordSignInAttemptPhase = "pending" | "event-observed" | "completed";
type PasswordSignInAttempt = {
  attemptId: number;
  actionRequestId: number;
  normalizedEmail: string;
  phase: PasswordSignInAttemptPhase;
  eventUserId: string | null;
};
type PasswordTrust = "provider" | "password-sign-in" | "password-setup";
type NormalSignOutStatus = "idle" | "pending" | "failed" | "completed";
type NormalSignOutOperation = {
  operationId: number;
  requestId: number;
  status: NormalSignOutStatus;
  observedSignedOut: boolean;
  consumed: boolean;
  capturedAuthState: AuthState | null;
};
const auth = getAuthFacade();
const emptyError = (operation: string): AuthError => ({ code: "unknown-auth-error", userMessage: "暂时没能完成，请稍后再试。", retryable: true, operation });

function HomeContent() {
  // Authentication state
  const [authState, setAuthState] = useState<AuthState>({ status: "initializing", user: null, error: null });
  const [a15LastEventType, setA15LastEventType] = useState<AuthSessionEvent["type"] | null>(null);
  const [a15LateInitializationDiscarded, setA15LateInitializationDiscarded] = useState(false);
  const [a15SignOutCallCount, setA15SignOutCallCount] = useState(0);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("welcome");
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const subscriptionGenerationRef = useRef(0);
  const authRevisionRef = useRef(0);
  const actionRequestIdRef = useRef(0);
  const taskFlowRevisionRef = useRef(0);
  const recoveryFailClosedLockRef = useRef(false);
  const [recoveryLocked, setRecoveryLocked] = useState(false);
  const recoveryRequestIdRef = useRef(0);
  const recoveryEpochRef = useRef<RecoveryEpoch>({
    epochId: 0,
    status: "idle",
    activeRequestId: null,
    observedSignedOut: false,
    consumed: false,
  });
  // Password sign-in lifecycle
  const passwordAttemptGenerationRef = useRef(0);
  const passwordActionOwnershipRef = useRef<number | null>(null);
  const passwordSignInAttemptRef = useRef<PasswordSignInAttempt | null>(null);
  const confirmedPasswordUserIdRef = useRef<string | null>(null);
  const recoveryOperationRef = useRef<RecoveryOperation | null>(null);
  // Normal sign-out lifecycle and task identity ownership
  const normalSignOutGenerationRef = useRef(0);
  const normalSignOutRequestIdRef = useRef(0);
  const normalSignOutOperationRef = useRef<NormalSignOutOperation | null>(null);
  const a15SignOutCallCountRef = useRef(0);
  const currentAuthenticatedUserIdRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [todayMode, setTodayMode] = useState<TodayMode>("home");
  const [todayState, setTodayState] = useState<TodayState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskHint, setTaskHint] = useState("");
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const completionRequestIdRef = useRef(0);
  const backController = useBackController();
  // Shared post-sign-out task and navigation reset
  const resetAfterSignOut = () => { setActiveTab("today");
  setTodayMode("home");
  setTodayState(null);
  setExecutingTaskId(null);
  setTaskHint(""); };
  const clearPasswordSignInAttempt = useCallback(() => {
    passwordSignInAttemptRef.current = null;
    passwordActionOwnershipRef.current = null;
  }, []);
  const invalidateAuthAction = useCallback(() => {
    actionRequestIdRef.current += 1;
    clearPasswordSignInAttempt();
  }, [clearPasswordSignInAttempt]);
  const navigateAuthScreen = useCallback((screen: AuthScreen) => {
    invalidateAuthAction();
    setAuthScreen(screen);
  }, [invalidateAuthAction]);
  // Successful Guest settlement
  const settleGuest = useCallback(({ releaseRecoveryLock }: { releaseRecoveryLock: boolean }) => {
    invalidateAuthAction();
    taskFlowRevisionRef.current += 1;
    completionRequestIdRef.current += 1;
    setIsGenerating(false);
    currentAuthenticatedUserIdRef.current = null;
    confirmedPasswordUserIdRef.current = null;
    recoveryOperationRef.current = null;
    recoveryRequestIdRef.current = 0;
    if (releaseRecoveryLock) {
      recoveryFailClosedLockRef.current = false;
      setRecoveryLocked(false);
    }
    resetAfterSignOut();
    setAuthScreen("welcome");
    setAuthState({ status: "guest", user: null, error: null });
  }, [invalidateAuthAction]);
  const markPasswordConfirmed = useCallback((userId: string) => {
    confirmedPasswordUserIdRef.current = userId;
  }, []);
  // Authenticated user reconciliation and password ownership
  const reconcileAuthenticatedUser = useCallback((incomingUser: AuthUser, options: {
    passwordTrust: PasswordTrust;
    resetNavigation: boolean;
  }) => {
    if (!recoveryFailClosedLockRef.current && recoveryEpochRef.current.status === "completed") {
      recoveryEpochRef.current = {
        epochId: recoveryEpochRef.current.epochId,
        status: "idle",
        activeRequestId: null,
        observedSignedOut: false,
        consumed: false,
      };
    }
    const previousUserId = currentAuthenticatedUserIdRef.current;
    if (previousUserId !== incomingUser.id) {
      taskFlowRevisionRef.current += 1;
      completionRequestIdRef.current += 1;
      setIsGenerating(false);
      resetAfterSignOut();
    }
    currentAuthenticatedUserIdRef.current = incomingUser.id;
    if (normalSignOutOperationRef.current?.status === "completed" && normalSignOutOperationRef.current.consumed) {
      normalSignOutOperationRef.current = null;
    }
    if (confirmedPasswordUserIdRef.current && confirmedPasswordUserIdRef.current !== incomingUser.id) {
      confirmedPasswordUserIdRef.current = null;
    }
    const passwordSet = options.passwordTrust === "provider"
      ? incomingUser.passwordSet || confirmedPasswordUserIdRef.current === incomingUser.id
      : true;
    if (passwordSet) markPasswordConfirmed(incomingUser.id);
    const user = { ...incomingUser, passwordSet };
    if (!user.passwordSet) navigateAuthScreen("password-setup");
    setAuthState({ status: user.passwordSet ? "authenticated" : "authenticated-needs-password", user, error: null });
    if (options.resetNavigation) { setActiveTab("today");
  setTodayMode("home");
  setExecutingTaskId(null); }
  }, [markPasswordConfirmed, navigateAuthScreen]);
  const isCurrentPasswordSignInAttempt = useCallback((attempt: PasswordSignInAttempt) => {
    return passwordSignInAttemptRef.current === attempt &&
      passwordAttemptGenerationRef.current === attempt.attemptId &&
      passwordActionOwnershipRef.current === attempt.attemptId &&
      attempt.phase !== "completed";
  }, []);
  // Password sign-in attempt lifecycle
  const isMatchingPasswordSignInEvent = useCallback((user: AuthUser) => {
    const attempt = passwordSignInAttemptRef.current;
    return Boolean(
      attempt &&
      !recoveryFailClosedLockRef.current &&
      passwordAttemptGenerationRef.current === attempt.attemptId &&
      passwordActionOwnershipRef.current === attempt.attemptId &&
      attempt.phase === "pending" &&
      attempt.normalizedEmail === user.email.trim().toLowerCase(),
    );
  }, []);
  const completePasswordSignInAttempt = useCallback((attempt: PasswordSignInAttempt) => {
    if (!isCurrentPasswordSignInAttempt(attempt)) return;
    attempt.phase = "completed";
    passwordSignInAttemptRef.current = null;
    passwordActionOwnershipRef.current = null;
  }, [isCurrentPasswordSignInAttempt]);
  const observePasswordSignInEvent = useCallback((user: AuthUser) => {
    if (!isMatchingPasswordSignInEvent(user)) return false;
    const attempt = passwordSignInAttemptRef.current;
    if (!attempt || !isCurrentPasswordSignInAttempt(attempt)) return false;
    attempt.eventUserId = user.id;
    attempt.phase = "event-observed";
    reconcileAuthenticatedUser({ ...user, passwordSet: true }, {
      passwordTrust: "password-sign-in",
      resetNavigation: false,
    });
    return true;
  }, [isCurrentPasswordSignInAttempt, isMatchingPasswordSignInEvent, reconcileAuthenticatedUser]);
  const isCurrentRecoveryOperation = useCallback((operation: RecoveryOperation) => {
    const epoch = recoveryEpochRef.current;
    return recoveryOperationRef.current === operation &&
      recoveryRequestIdRef.current === operation.requestId &&
      epoch.epochId === operation.epochId &&
      epoch.activeRequestId === operation.requestId &&
      epoch.status === "active" &&
      recoveryFailClosedLockRef.current;
  }, []);
  // Recovery lifecycle
  const markRecoveryEpochFailed = useCallback((operation: RecoveryOperation, error: AuthError) => {
    if (!isCurrentRecoveryOperation(operation)) return;
    operation.status = "failed";
    operation.settledResult = "failure";
    recoveryEpochRef.current = {
      ...recoveryEpochRef.current,
      status: "failed",
    };
    setAuthState({ status: "error", user: null, error });
  }, [isCurrentRecoveryOperation]);
  const completeRecoveryEpoch = useCallback((operation: RecoveryOperation) => {
    if (!isCurrentRecoveryOperation(operation)) return;
    operation.status = "succeeded";
    operation.settledResult = "success";
    recoveryEpochRef.current = {
      ...recoveryEpochRef.current,
      status: "completed",
      consumed: true,
    };
    settleGuest({ releaseRecoveryLock: true });
  }, [isCurrentRecoveryOperation, settleGuest]);
  const handleRecoverySignOutResult = useCallback((operation: RecoveryOperation, result: AuthResult<void>) => {
    if (!isCurrentRecoveryOperation(operation)) return;
    if (result.ok) {
      completeRecoveryEpoch(operation);
      return;
    }
    markRecoveryEpochFailed(operation, result.error);
  }, [completeRecoveryEpoch, isCurrentRecoveryOperation, markRecoveryEpochFailed]);
  const handleRecoverySignOutRejection = useCallback((operation: RecoveryOperation) => {
    markRecoveryEpochFailed(operation, {
      code: "recovery-sign-out-failed",
      userMessage: "暂时没能安全退出，请再试一次。",
      retryable: true,
      operation: "recovery-sign-out",
    });
  }, [markRecoveryEpochFailed]);
  const observeRecoveryOperation = useCallback((operation: RecoveryOperation) => {
    void operation.promise.then(
      (result) => handleRecoverySignOutResult(operation, result),
      () => handleRecoverySignOutRejection(operation),
    );
  }, [handleRecoverySignOutRejection, handleRecoverySignOutResult]);
  const signOutThroughController = useCallback(() => {
    if (process.env.NODE_ENV === "development") {
      a15SignOutCallCountRef.current += 1;
      setA15SignOutCallCount(a15SignOutCallCountRef.current);
    }
    return auth.signOut();
  }, []);
  const startRecoverySignOut = useCallback((epochId: number) => {
    const requestId = recoveryRequestIdRef.current + 1;
    recoveryRequestIdRef.current = requestId;
    recoveryEpochRef.current = {
      ...recoveryEpochRef.current,
      activeRequestId: requestId,
    };
    const operation: RecoveryOperation = {
      epochId,
      requestId,
      promise: Promise.resolve().then(() => signOutThroughController()),
      status: "pending",
      settledResult: null,
    };
    recoveryOperationRef.current = operation;
    observeRecoveryOperation(operation);
  }, [observeRecoveryOperation, signOutThroughController]);
  const beginRecoveryEpoch = useCallback(() => {
    if (recoveryEpochRef.current.status !== "idle") return;
    authRevisionRef.current += 1;
    invalidateAuthAction();
    clearPasswordSignInAttempt();
    confirmedPasswordUserIdRef.current = null;
    currentAuthenticatedUserIdRef.current = null;
    taskFlowRevisionRef.current += 1;
    completionRequestIdRef.current += 1;
    recoveryFailClosedLockRef.current = true;
    setRecoveryLocked(true);
    const epochId = recoveryEpochRef.current.epochId + 1;
    recoveryEpochRef.current = {
      epochId,
      status: "active",
      activeRequestId: null,
      observedSignedOut: false,
      consumed: false,
    };
    setAuthState({ status: "recovery-signout-pending", user: null, error: null });
    startRecoverySignOut(epochId);
  }, [clearPasswordSignInAttempt, invalidateAuthAction, startRecoverySignOut]);
  const retryRecoverySignOut = useCallback(() => {
    const epoch = recoveryEpochRef.current;
    const operation = recoveryOperationRef.current;
    if (!recoveryFailClosedLockRef.current || epoch.status !== "failed" || operation?.status !== "failed" || operation.settledResult !== "failure") return;
    recoveryEpochRef.current = {
      ...epoch,
      status: "active",
      activeRequestId: null,
    };
    setAuthState({ status: "recovery-signout-pending", user: null, error: null });
    startRecoverySignOut(epoch.epochId);
  }, [startRecoverySignOut]);
  const restoreConfirmedPasswordOwnership = useCallback((captured: AuthState | null) => {
    if (captured?.status === "authenticated" && captured.user?.passwordSet) {
      confirmedPasswordUserIdRef.current = captured.user.id;
      return;
    }
    confirmedPasswordUserIdRef.current = null;
  }, []);
  const isCurrentNormalSignOutOperation = useCallback((operation: NormalSignOutOperation) => {
    return normalSignOutOperationRef.current === operation &&
      normalSignOutGenerationRef.current === operation.operationId &&
      normalSignOutRequestIdRef.current === operation.requestId;
  }, []);
  const completeNormalSignOutOperation = useCallback((operation: NormalSignOutOperation) => {
    if (!isCurrentNormalSignOutOperation(operation) || operation.status !== "pending" || operation.consumed) return;
    operation.status = "completed";
    operation.consumed = true;
    settleGuest({ releaseRecoveryLock: false });
  }, [isCurrentNormalSignOutOperation, settleGuest]);
  const restoreNormalSignOutFailure = useCallback((operation: NormalSignOutOperation) => {
    if (!isCurrentNormalSignOutOperation(operation) || operation.status !== "pending" || operation.consumed) return;
    operation.status = "failed";
    setIsGenerating(false);
    restoreConfirmedPasswordOwnership(operation.capturedAuthState);
    currentAuthenticatedUserIdRef.current = operation.capturedAuthState?.user?.id ?? null;
    if (operation.capturedAuthState) setAuthState(operation.capturedAuthState);
  }, [isCurrentNormalSignOutOperation, restoreConfirmedPasswordOwnership]);
  const handleAuthEvent = useCallback((event: AuthSessionEvent, generation: number) => {
    if (generation !== subscriptionGenerationRef.current || event.type === "INITIAL_SESSION") {
      return;
    }
    if (process.env.NODE_ENV === "development") setA15LastEventType(event.type);

    // Recovery event precedence
    if (event.type === "PASSWORD_RECOVERY") {
      beginRecoveryEpoch();
      return;
    }

    authRevisionRef.current += 1;
    actionRequestIdRef.current += 1;

    if (event.type === "SIGNED_OUT") {
      const epoch = recoveryEpochRef.current;
      if (recoveryFailClosedLockRef.current || epoch.status === "active" || epoch.status === "failed") {
        recoveryEpochRef.current = { ...epoch, observedSignedOut: true };
        return;
      }
      if (epoch.status === "completed") {
        return;
      }

      const normalSignOut = normalSignOutOperationRef.current;
      if (normalSignOut?.status === "pending" || normalSignOut?.status === "failed") {
        normalSignOut.observedSignedOut = true;
        if (!normalSignOut.consumed) {
          normalSignOut.status = "completed";
          normalSignOut.consumed = true;
          settleGuest({ releaseRecoveryLock: false });
        }
        return;
      }
      // Completed normal sign-out delayed event no-op.
      if (normalSignOut?.status === "completed" && normalSignOut.consumed) {
        return;
      }
      settleGuest({ releaseRecoveryLock: false });
      return;
    }

    if (recoveryFailClosedLockRef.current) {
      return;
    }
    if (!event.user) {
      setAuthState({ status: "error", user: null, error: emptyError("auth-event") });
      return;
    }
    if (
      normalSignOutOperationRef.current?.status === "pending" &&
      (event.type === "SIGNED_IN" || event.type === "TOKEN_REFRESHED" || event.type === "USER_UPDATED")
    ) {
      return;
    }
    if (event.type === "SIGNED_IN" && observePasswordSignInEvent(event.user)) {
      return;
    }
    if (event.type === "SIGNED_IN") {
      clearPasswordSignInAttempt();
    }
    if (event.type === "TOKEN_REFRESHED" || event.type === "USER_UPDATED") {
      clearPasswordSignInAttempt();
    }
    reconcileAuthenticatedUser(event.user, { passwordTrust: "provider", resetNavigation: false });
  }, [beginRecoveryEpoch, clearPasswordSignInAttempt, observePasswordSignInEvent, reconcileAuthenticatedUser, settleGuest]);
  const applyInitializationResult = useCallback((result: AuthResult<AuthUser | null>, generation: number, initRevision: number) => {
    const discarded =
      generation !== subscriptionGenerationRef.current ||
      initRevision !== authRevisionRef.current ||
      recoveryFailClosedLockRef.current;
    if (process.env.NODE_ENV === "development") setA15LateInitializationDiscarded(discarded);
    if (discarded) return;
    if (!result.ok) {
      setAuthState({ status: "error", user: null, error: result.error });
      return;
    }
    if (!result.data) {
      settleGuest({ releaseRecoveryLock: false });
      return;
    }
    reconcileAuthenticatedUser(result.data, { passwordTrust: "provider", resetNavigation: true });
  }, [reconcileAuthenticatedUser, settleGuest]);
  // Authentication subscription; branch order is part of the state-machine contract.
  useEffect(() => {
    const generation = ++subscriptionGenerationRef.current;
    const unsubscribe = auth.subscribeAuthState((event) => handleAuthEvent(event, generation));
    const initRevision = authRevisionRef.current;
    void auth.getCurrentUser().then((result) => {
      applyInitializationResult(result, generation, initRevision);
    });
    return () => {
      if (generation === subscriptionGenerationRef.current) {
        subscriptionGenerationRef.current += 1;
      }
      currentAuthenticatedUserIdRef.current = null;
      clearPasswordSignInAttempt();
      unsubscribe();
    };
  }, [applyInitializationResult, clearPasswordSignInAttempt, handleAuthEvent, initializationAttempt]);
  const action = async <T,>(operation: () => Promise<AuthResult<T>>, apply: (result: AuthResult<T>) => void) => { invalidateAuthAction();
  const request = ++actionRequestIdRef.current;
  const revision = authRevisionRef.current;
  const result = await operation();
  if (request === actionRequestIdRef.current && revision === authRevisionRef.current && !recoveryFailClosedLockRef.current) apply(result);
  return result; };
  const sendOtp = (email: string) => action(() => auth.sendOtp({ email, intent: "sign-in" }), () => undefined);
  const verifyOtp = (email: string, code: string) => action(() => auth.verifyOtp({ email, code, intent: authScreen === "register" ? "sign-up" : "sign-in" }), (result) => { if (result.ok) reconcileAuthenticatedUser(result.data, { passwordTrust: "provider", resetNavigation: !authState.user || authState.user.id !== result.data.id }); });
  const beginPasswordSignInAttempt = useCallback((email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    invalidateAuthAction();
    const attemptId = passwordAttemptGenerationRef.current + 1;
    passwordAttemptGenerationRef.current = attemptId;
    passwordActionOwnershipRef.current = attemptId;
    const actionRequestId = ++actionRequestIdRef.current;
    const attempt: PasswordSignInAttempt = {
      attemptId,
      actionRequestId,
      normalizedEmail,
      phase: "pending",
      eventUserId: null,
    };
    passwordSignInAttemptRef.current = attempt;
    return attempt;
  }, [invalidateAuthAction]);
  const handlePasswordSignInResult = useCallback((attempt: PasswordSignInAttempt, result: AuthResult<AuthUser>) => {
    if (!isCurrentPasswordSignInAttempt(attempt)) return result;
    if (attempt.phase === "event-observed") {
      completePasswordSignInAttempt(attempt);
      return {
        ok: true as const,
        data: {
          id: attempt.eventUserId ?? "",
          email: attempt.normalizedEmail,
          passwordSet: true,
        },
      };
    }
    if (attempt.actionRequestId !== actionRequestIdRef.current || recoveryFailClosedLockRef.current) return result;
    if (!result.ok) {
      clearPasswordSignInAttempt();
      return result;
    }
    reconcileAuthenticatedUser({ ...result.data, passwordSet: true }, {
      passwordTrust: "password-sign-in",
      resetNavigation: !authState.user || authState.user.id !== result.data.id,
    });
    completePasswordSignInAttempt(attempt);
    return result;
  }, [clearPasswordSignInAttempt, completePasswordSignInAttempt, isCurrentPasswordSignInAttempt, reconcileAuthenticatedUser, authState.user]);
  const handlePasswordSignInRejection = useCallback((attempt: PasswordSignInAttempt): AuthResult<AuthUser> => {
    const error = emptyError("password-sign-in");
    if (!isCurrentPasswordSignInAttempt(attempt)) return { ok: false, error };
    if (attempt.phase === "event-observed") {
      completePasswordSignInAttempt(attempt);
      return {
        ok: true as const,
        data: {
          id: attempt.eventUserId ?? "",
          email: attempt.normalizedEmail,
          passwordSet: true,
        },
      };
    }
    clearPasswordSignInAttempt();
    return { ok: false, error };
  }, [clearPasswordSignInAttempt, completePasswordSignInAttempt, isCurrentPasswordSignInAttempt]);
  const signInPassword = (email: string, password: string) => {
  const attempt = beginPasswordSignInAttempt(email);
  return auth.signInWithPassword({ email: attempt.normalizedEmail, password }).then(
    (result) => handlePasswordSignInResult(attempt, result),
    () => handlePasswordSignInRejection(attempt),
  ); };
  const setPassword = (password: string) => action(() => auth.setPassword({ password }), (result) => { if (result.ok) reconcileAuthenticatedUser({ ...result.data, passwordSet: true }, { passwordTrust: "password-setup", resetNavigation: false }); });
  const explicitSignOut = async () => {
    if (recoveryFailClosedLockRef.current || normalSignOutOperationRef.current?.status === "pending") {
      return { ok: false as const, error: emptyError("sign-out") };
    }
    const captured = authState.status === "authenticated" || authState.status === "authenticated-needs-password" ? authState : null;
    invalidateAuthAction();
    taskFlowRevisionRef.current += 1;
    completionRequestIdRef.current += 1;
    currentAuthenticatedUserIdRef.current = null;
    confirmedPasswordUserIdRef.current = null;
    const operation: NormalSignOutOperation = {
      operationId: normalSignOutGenerationRef.current + 1,
      requestId: normalSignOutRequestIdRef.current + 1,
      status: "pending",
      observedSignedOut: false,
      consumed: false,
      capturedAuthState: captured,
    };
    normalSignOutGenerationRef.current = operation.operationId;
    normalSignOutRequestIdRef.current = operation.requestId;
    normalSignOutOperationRef.current = operation;
    setAuthState((state) => ({ ...state, status: "signing-out" }));
    let result: AuthResult<void>;
    try { result = await signOutThroughController(); } catch { result = { ok: false as const, error: emptyError("sign-out") }; }
    if (!isCurrentNormalSignOutOperation(operation)) return result;
    if (result.ok) completeNormalSignOutOperation(operation);
    else restoreNormalSignOutFailure(operation);
    return result;
  };
  const runA15ControllerHarness = useCallback((scenario: A15HarnessScenario) => {
    if (process.env.NODE_ENV !== "development") return;
    const generation = subscriptionGenerationRef.current;
    const syntheticUser: AuthUser = {
      id: "a15-probe-user",
      email: "a15-probe@invalid",
      passwordSet: true,
    };
    if (scenario === "delayed-initialization") {
      const initRevision = authRevisionRef.current;
      authRevisionRef.current += 1;
      applyInitializationResult({ ok: true, data: syntheticUser }, generation, initRevision);
      return;
    }
    handleAuthEvent({
      type: scenario,
      user: scenario === "SIGNED_OUT" || scenario === "PASSWORD_RECOVERY" ? null : syntheticUser,
    }, generation);
  }, [applyInitializationResult, handleAuthEvent]);
  const retryInitialization = useCallback(() => {
    if (recoveryFailClosedLockRef.current) return;
    invalidateAuthAction();
    clearPasswordSignInAttempt();
    setInitializationAttempt((attempt) => attempt + 1);
  }, [clearPasswordSignInAttempt, invalidateAuthAction]);
  useEffect(() => { if (authState.status === "guest" || authState.status === "error") { backController.register({ id: "page-auth-flow", priority: 60, handle: () => { if (authScreen === "register" || authScreen === "password-login") { navigateAuthScreen("otp-login");
  return true; } if (authScreen === "otp-login") { navigateAuthScreen("welcome");
  return true; } return false; } });
  return () => backController.unregister("page-auth-flow"); } }, [authScreen, authState.status, backController, navigateAuthScreen]);
  useEffect(() => { if (authState.status !== "authenticated") return; backController.register({ id: "page-authenticated-root", priority: 50, handle: () => { if (activeTab !== "today") { setActiveTab("today");
  return true; } if (todayMode === "execution") { setExecutingTaskId(null);
  setTodayMode("tasks");
  return true; } if (todayMode === "action-list") { setTodayMode("tasks");
  return true; } if (todayMode === "tasks") { setTodayMode("home");
  return true; } return false; } });
  return () => backController.unregister("page-authenticated-root"); }, [activeTab, authState.status, backController, todayMode]);
  useEffect(() => { backController.register({ id: "action-list", priority: 85, handle: () => { if (authState.status !== "authenticated" || activeTab !== "today" || todayMode !== "action-list") return false;
  setTodayMode("tasks");
  return true; } });
  return () => backController.unregister("action-list"); }, [activeTab, authState.status, backController, todayMode]);
  async function handleGenerateGoal(goal: string) {
    const ownerUserId = currentAuthenticatedUserIdRef.current;
    if (!ownerUserId) return;
    const ownerAuthRevision = authRevisionRef.current;
    const requestId = taskFlowRevisionRef.current + 1;
    taskFlowRevisionRef.current = requestId;
    const ownsTaskWrite = () => requestId === taskFlowRevisionRef.current &&
      currentAuthenticatedUserIdRef.current === ownerUserId &&
      authRevisionRef.current === ownerAuthRevision &&
      !recoveryFailClosedLockRef.current &&
      normalSignOutOperationRef.current?.status !== "pending";
    setTaskHint("");
    setIsGenerating(true);
    try {
      await generateTasks(goal);
      const next = await getTodayState();
      if (!ownsTaskWrite()) return;
      setTodayState(next);
      setExecutingTaskId(null);
      setTodayMode("tasks");
    } finally {
      if (ownsTaskWrite()) setIsGenerating(false);
    }
  }
  async function handleCompleteTask(id: string) {
    const ownerUserId = currentAuthenticatedUserIdRef.current;
    if (!ownerUserId) return;
    const ownerAuthRevision = authRevisionRef.current;
    const revision = taskFlowRevisionRef.current;
    const requestId = ++completionRequestIdRef.current;
    const next = await completeTask(id);
    const stillCurrent =
      revision === taskFlowRevisionRef.current &&
      !recoveryFailClosedLockRef.current &&
      currentAuthenticatedUserIdRef.current === ownerUserId &&
      authRevisionRef.current === ownerAuthRevision &&
      requestId === completionRequestIdRef.current &&
      normalSignOutOperationRef.current?.status !== "pending";

    if (!stillCurrent) return;

    setTodayState(next);
    setTaskHint("");
    setExecutingTaskId(null);
    setTodayMode("tasks");
  }
  // Render gates
  const renderToday = () => {
    if (todayMode === "execution" && todayState) {
      const task = todayState.tasks.find((item) => item.id === executingTaskId);
      if (task) {
        return <TaskExecutionView task={task} onBack={() => { setExecutingTaskId(null); setTodayMode("tasks"); }} onComplete={handleCompleteTask} />;
      }
    }
    if (todayMode === "action-list" && todayState) {
      return <ActionListView todayState={todayState} onBack={() => setTodayMode("tasks")} />;
    }
    if (todayMode === "tasks" && todayState) {
      return <TaskListView todayState={todayState} hint={taskHint} onBackHome={() => setTodayMode("home")} onStartTask={(id) => { setExecutingTaskId(id); setTodayMode("execution"); }} onCompleteTask={handleCompleteTask} onLockedTaskClick={() => setTaskHint("先完成眼前这一小步")} onOpenActionList={() => setTodayMode("action-list")} />;
    }
    return <TodayHomeView isGenerating={isGenerating} hasUnfinishedTasks={todayState?.tasks.some((task) => task.status !== "completed") ?? false} onGenerateGoal={handleGenerateGoal} onNavigateToMe={() => setActiveTab("me")} onResumeTasks={() => setTodayMode("tasks")} />;
  };
  let withA15Probe = (content: ReactNode) => content;
  /* A1_5_PROBE_START */
  const a15MaskedEmail = authState.user
    ? `${authState.user.email.slice(0, 1)}***${authState.user.email.slice(authState.user.email.indexOf("@"))}`
    : null;
  const a15TruncatedUserId = authState.user ? `${authState.user.id.slice(0, 8)}…` : null;
  const a15Probe = process.env.NODE_ENV === "development" ? (
    <A15SessionProbe
      authStatus={authState.status}
      maskedEmail={a15MaskedEmail}
      truncatedUserId={a15TruncatedUserId}
      isCurrentUserId={(userId) => authState.user?.id === userId}
      appShellAllowed={authState.status === "authenticated"}
      recoveryLockActive={recoveryLocked}
      lastEventType={a15LastEventType}
      lateInitializationDiscarded={a15LateInitializationDiscarded}
      signOutCallCount={a15SignOutCallCount}
      operationInProgress={authState.status === "signing-out" || authState.status === "recovery-signout-pending"}
      onSendOtp={(email, intent) => action(() => auth.sendOtp({ email, intent }), () => undefined)}
      onVerifyOtp={(email, code, intent) => action(() => auth.verifyOtp({ email, code, intent }), (result) => {
        if (result.ok) reconcileAuthenticatedUser(result.data, { passwordTrust: "provider", resetNavigation: !authState.user || authState.user.id !== result.data.id });
      })}
      onSignOut={explicitSignOut}
      onRunHarness={runA15ControllerHarness}
      onSendRecoveryOtp={(input) => auth.sendRecoveryOtp(input)}
    />
  ) : null;
  withA15Probe = (content: ReactNode) => <>{a15Probe}{content}</>;
  /* A1_5_PROBE_END */
  if (recoveryLocked) return withA15Probe(<AuthShell><main className="grid h-full place-items-center gap-4 px-6 text-center"><p className="text-text-secondary">{authState.error?.userMessage ?? "正在安全退出登录状态…"}</p>{authState.status === "error" ? <button className="min-h-touch text-brand-blue" type="button" onClick={retryRecoverySignOut}>重新尝试</button> : null}</main></AuthShell>);
  if (authState.status === "authenticated") return withA15Probe(<AppShell activeTab={activeTab} onTabChange={setActiveTab}>{activeTab === "today" ? renderToday() : activeTab === "footprint" ? <FootprintsView isActive onNavigateToToday={() => setActiveTab("today")} /> : activeTab === "growth" ? <GrowthView onNavigateToToday={() => setActiveTab("today")} /> : <MeView isActive onLogout={() => void explicitSignOut()} />}</AppShell>);
  if (authState.status === "authenticated-needs-password") return withA15Probe(<AuthShell><RegisterPage mode="required-password-setup" verifiedEmail={authState.user?.email ?? ""} onSetPassword={setPassword} onExplicitSignOut={explicitSignOut} /></AuthShell>);
  if (authState.status === "initializing" || authState.status === "authenticating" || authState.status === "signing-out" || authState.status === "recovery-signout-pending") return withA15Probe(<AuthShell><main className="grid h-full place-items-center text-text-secondary">正在处理登录状态…</main></AuthShell>);
  if (authState.status === "error") return withA15Probe(<AuthShell><main className="grid h-full place-items-center gap-4 px-6 text-center"><p className="text-text-secondary">{authState.error?.userMessage}</p><button className="min-h-touch text-brand-blue" type="button" onClick={retryInitialization}>重新尝试</button></main></AuthShell>);
  if (authScreen === "otp-login") return withA15Probe(<AuthShell><OtpLoginPage onNavigate={navigateAuthScreen} onSendOtp={sendOtp} onVerifyOtp={verifyOtp} /></AuthShell>);
  if (authScreen === "password-login") return withA15Probe(<AuthShell><PasswordLoginPage onNavigate={navigateAuthScreen} onSignInWithPassword={signInPassword} /></AuthShell>);
  if (authScreen === "register") return withA15Probe(<AuthShell><RegisterPage mode="register" onNavigate={navigateAuthScreen} onSendOtp={(email) => action(() => auth.sendOtp({ email, intent: "sign-up" }), () => undefined)} onVerifyOtp={verifyOtp} /></AuthShell>);
  return withA15Probe(<AuthShell bottomInsetHandledByChild><WelcomePage onNavigate={navigateAuthScreen} /></AuthShell>);
}
export default function Page() { return <BackControllerProvider><HomeContent /></BackControllerProvider>; }
