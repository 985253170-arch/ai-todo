# V3.1-A Execution Plan — Mobile 真实认证与 Recovery OTP

> **状态：** R1、R2 已完成、Review、提交并 Push，正式关闭。当前为 R3 Session ID Evidence Contract 三文档修订，等待完整 Review；文档 Review 通过不构成代码或提交授权。
>
> **当前阶段：** R3 三文档完整一致性通过后，仍须依次经 ChatGPT 判断文档可以提交、用户确认、精确提交三份文档，并确认文档提交成功、staged 已为空，且 R3 代码及其他文件未进入该文档提交；只有随后 ChatGPT 明确授权，才可施工以下未来五文件：
> ```text
> R1 Contract Extension
> +
> R3 Controller Consumption
> ```
> R4 未授权，且不得在 R3 的实现、Claude Code Review、ChatGPT 最终判断与用户提交确认前评估。

---

## 1. 当前基线、阶段账本与旧方案废弃

| 阶段 / 项目 | 当前事实 |
|---|---|
| HEAD / origin/main | `aba8eacdaa4ae18cb7e8cb1ac8c27ec9cbee8158`，二者一致。 |
| R1 | 已完成、Review、提交并 Push，正式关闭；以下 R1 card 仅保留为 Historical / Completed record。 |
| R2 | 已完成、Review、提交并 Push，正式关闭；以下 R2 card 仅保留为 Historical / Completed record。 |
| R3 | Session ID Evidence Contract 三文档修订中。R3 代码尚未通过、不可提交；Review 通过后仍须由 ChatGPT 判断文档可以提交、用户确认并精确提交三份文档，确认文档提交成功、staged 已为空，且 R3 代码及其他文件未进入该文档提交后，才可由 ChatGPT 明确授权进入五文件 `R1 Contract Extension + R3 Controller Consumption` 施工。 |
| R4 | 未授权；不得在 R3 实施、Claude Code Review、ChatGPT 最终判断与用户提交确认前评估。 |
| R6a / R6b | R6a 为 Development Reset Password Email Template `{{ .Token }}` 的独立外部门禁；R6b 为真实运行验证门禁，均未授权。 |

现有其他工作区 dirty/untracked 内容均不属于本 card 的授权范围；不得回滚、清理、暂存或重新归类。

Recovery 的唯一正式流程：

```text
recovery-email-entry
→ recovery-requesting
→ recovery-code-entry
→ recovery-code-verifying
→ recovery-password-required
→ recovery-password-updating
→ recovery-signout-pending
→ recovery-complete
→ password-login
```

以下仅作为废弃历史记录，不得成为施工路径：

```text
resetPasswordForEmail(..., { redirectTo })
→ ConfirmationURL / token_hash
→ 邮件链接回跳
→ PASSWORD_RECOVERY 后立即 local signOut
```

当前唯一语义：

```ts
sendRecoveryOtp({ email })
// auth.resetPasswordForEmail(email)，不传 redirectTo

verifyRecoveryOtp({ email, code })
// auth.verifyOtp({ email, token: code, type: "recovery" })

updateRecoveryPassword({ password, expectedSessionId })
// auth.updateUser({ password, data: { password_set: true } })
// adapter pre/post current Session ID must equal expectedSessionId
```

Recovery owner 消费匹配的 `USER_UPDATED` 后，执行 `auth.signOut({ scope: "local" })`；signOut 成功后才清 marker，收敛 guest，再进入 `password-login`。Recovery Session 绝不进入 ordinary `authenticated` 或 AppShell。

---

## 2. 真实代码映射与不可变实现边界

1. `apps/mobile-app/services/authService.ts` 是唯一 facade selector；当前尚无 Recovery actions。
2. `apps/mobile-app/services/authService.real.ts` 只经 `getSupabaseBrowserClient()` 使用一个 cached Browser Client；其 `onAuthStateChange` 只同步归一化并通知 listener；不得改变为 async callback。
3. `apps/mobile-app/app/page.tsx` 已有唯一 facade、唯一 Auth subscription、`subscriptionGenerationRef`、`authRevisionRef`、action request IDs、初始化 guard、normal signOut ownership 与旧的 Recovery immediate-signOut 分支。未来只能在同一 controller 内替换该旧分支。
4. `apps/mobile-app/lib/supabase-client.ts` 必须持续是唯一 Browser Client factory；不得新增第二 client。
5. `apps/mobile-app/components/auth/A15SessionProbe.tsx` 必须只经父级 callback 使用 controller/facade；不得 import Real adapter 或 Browser Client，且不得建立 reducer / subscription。
6. A1.5-R 不修改 `apps/mobile-app/package.json`、`apps/mobile-app/package-lock.json`、三项正式 Auth 页面、`src/**`、Gateway、API Route、schema、RLS、migration 或 prompts。

---

## 3. Facade、Session proof 与错误分层

### 3.1 Permanent facade additions

`apps/mobile-app/services/authService.ts` 继续是唯一页面入口，新增：

```ts
export interface SendRecoveryOtpInput { email: string; }
export interface VerifyRecoveryOtpInput { email: string; code: string; }
export interface UpdateRecoveryPasswordInput {
  password: string;
  expectedSessionId: string;
}
export interface RecoveryOtpDelivery { resendAfterSeconds: 60; }
export interface RecoverySessionEvidence {
  user: AuthUser;
  sessionId: string;
}

sendRecoveryOtp(input: SendRecoveryOtpInput): Promise<AuthResult<RecoveryOtpDelivery>>;
verifyRecoveryOtp(input: VerifyRecoveryOtpInput): Promise<AuthResult<RecoverySessionEvidence>>;
updateRecoveryPassword(input: UpdateRecoveryPasswordInput): Promise<AuthResult<RecoverySessionEvidence>>;
```

`AuthSessionEvent` 的最小新增字段为 `sessionId: string | null`。

| action | Real adapter | Mock adapter | security boundary |
|---|---|---|---|
| `sendRecoveryOtp` | exact `auth.resetPasswordForEmail(email)`；无第二参数。 | 仅模块内存 delivery state；不建 Session/event。 | email 只在调用期间。 |
| `verifyRecoveryOtp` | 必须同时确认 `data.user` 与 `data.session` 非空；adapter 私有、同步地从成功 Session 提取格式正确的 JWT `session_id`，并仅返回 `{ user, sessionId }`。提取失败必须返回 fail-closed `recovery-session-invalid`。 | 只为当前 owner harness 建内存 Recovery Session、生成新的 mock session ID，并以同一 ID 发 normalized `PASSWORD_RECOVERY`。 | facade 不返回 Session/token/Cookie；原始 JWT 不得离开 Real adapter。 |
| `updateRecoveryPassword` | 调用前与调用后均须确认当前 Session ID 精确等于 `expectedSessionId`；只返回 `{ user, sessionId }`。 | 只在当前 mock Recovery Session ID 与 `expectedSessionId` 一致时更新 metadata，以同一 ID 发 `USER_UPDATED`。 | password 只存在当前 form/action；`expectedSessionId` 仅由 Controller 内存持有。 |

Promise evidence 是 adapter 已确认 `data.user + data.session` 后返回的最小 `RecoverySessionEvidence`；event evidence 是 normalized `PASSWORD_RECOVERY` 的最小 `AuthSessionEvent`。两份 evidence 的 user ID 和非空 `sessionId` 都必须完全匹配。双证据匹配后，controller 使用既有 facade 的 `getCurrentUser()` **一次**确认当前 user：只接受 `ok && data !== null && data.id` 同时匹配两份 evidence 的结果；该 read 绑定当前 flowId、attemptId、document generation、marker revision 与 recoveryRevision，不新建初始化路径，不保存原始 Session。null/error/ID mismatch/sessionId mismatch 必须 fail closed。

Session ID extraction 只能在 Real adapter 私有、同步边界内短暂读取 `session.access_token` 并提取格式正确的 JWT payload `session_id`。不得向 facade 或 Controller 传递 token、payload、hash 或 fingerprint；不得在 `onAuthStateChange` callback 调用异步 `getClaims()`，不得因 extraction 触发 refresh 或 callback reentry。`sessionId` 只用于 provider event correlation，不是 identity trust、owner authority、marker/storage/UI/log/error 字段或 token 替代品；最终 user identity 仍由 `getCurrentUser()` 确认。

### 3.2 Error layers

`AuthErrorCode` 只容纳页面可安全展示的稳定类别：

```ts
"recovery-request-failed"
| "recovery-verify-failed"
| "recovery-session-invalid"
| "recovery-marker-invalid"
| "recovery-sign-out-failed"
| "recovery-evidence-timeout"
| "recovery-storage-unavailable"
| "recovery-password-update-failed"
```

内部 `RecoveryOperationReason` 仅供 controller 分流/安全日志：`owner-refresh`、`observer-existing-flow`、`tab-identity-conflict`、`marker-expired`、`marker-corrupt`、`event-user-mismatch`、`event-session-mismatch`、`session-id-unavailable`、`late-evidence`。Probe 只显示非敏感状态标签；日志只记录 reason、event type、attempt/flow 是否匹配，不记录 email、OTP、password、token、Cookie、Session ID、URL、raw provider payload。不得依赖 raw provider message 做页面判断。

---

## 4. Marker、tab identity、非原子冲突与 lifecycle

### 4.1 Schema and constants

R2 新增唯一 helper `apps/mobile-app/lib/recovery-marker.ts`，只处理 schema、storage、parse、compare、classification；不得调用 Supabase、fetch、React state。

```ts
export const RECOVERY_MARKER_KEY = "qingxing.auth.recovery.v1";
export const RECOVERY_TAB_ID_KEY = "qingxing.auth.tab-id.v1";
export const RECOVERY_MARKER_VERSION = 1;
export const RECOVERY_MARKER_TTL_MS = 15 * 60 * 1000;
export const RECOVERY_EVIDENCE_TIMEOUT_MS = 12 * 1000;
export const RECOVERY_VERIFY_REQUEST_TIMEOUT_MS = 30 * 1000;
export const RECOVERY_UPDATE_TIMEOUT_MS = 30 * 1000;
export const RECOVERY_SIGN_OUT_TIMEOUT_MS = 15 * 1000;

export type RecoveryMarkerPhase =
  | "verifying"
  | "password-required"
  | "updating"
  | "signing-out";

export interface RecoveryMarkerV1 {
  version: 1;
  flowId: string;
  ownerTabId: string;
  phase: RecoveryMarkerPhase;
  createdAt: number;
  expiresAt: number;
}
```

marker 严格只含六字段；禁止 email、userId、OTP、password、token、Cookie、Session、URL、masked email、instance ID 或 provider payload。

### 4.2 Parse and absolute expiry

parse 仅接受 plain object 且拒绝任何额外字段，验证 version、UUID `flowId`/`ownerTabId`、phase、有限 timestamps、`expiresAt > createdAt`、`expiresAt === createdAt + RECOVERY_MARKER_TTL_MS`、`now < expiresAt`。若 `now + 60_000 < createdAt`，视为系统时钟回拨/不安全 marker。睡眠恢复、`pageshow`、visibility return、storage event 和任何 timer 先重读并重验 marker。

15 分钟从 controller 在 `verifyRecoveryOtp` 前成功写入 `verifying` marker 时开始，是绝对不可续期 deadline。`password-required`、`updating`、`signing-out` 保留相同 `createdAt`/`expiresAt`。update operation 一旦启动即消费该 Recovery Session；失败只可受控 cleanup，不能在同一 Session retry。deadline 到达时 owner 使当前 attempt settled，启动一次 fail-closed signOut。safe guest 后用户重新开始 verify 才能生成新 flowId、新 Recovery Session 和新 15 分钟周期。

### 4.3 tabId、duplicated tab and owner rule

- 每个 document 启动读取 `sessionStorage[RECOVERY_TAB_ID_KEY]`；不存在/无效时用 `crypto.randomUUID()` 创建并写入。该值只作 marker owner 候选，不能证明身份或 owner privilege。
- 当前 owner 的必要条件是：当前 document 有**本页面生命周期内**、在 verify 前创建且仍 active 的 `recoveryOtpVerificationAttempt`，并且 marker ownerTabId 匹配。只匹配 persisted tabId 绝不够。
- reload 和 browser duplicated tab 都丢失 in-memory attempt。即使浏览器复制 sessionStorage 且 two tabs 有相同 tabId，新的 document 没有 active attempt，必须 `recovery-blocked`/uncertain，不能恢复 owner、password UI、update 或 signOut ownership。
- Strict Mode effect replay 不创建新 attempt、不轮换 tabId；它只能重新观察同一 document 的 refs。

### 4.4 localStorage has no CAS and bounded conflict convergence

`localStorage` 不提供原子 compare-and-swap；read-validate-write 不是锁，也不能把任一次成功 `getItem()` 当作独占证明。协调只发生在调用 provider **之前**：verify action 必须先让当前 flow 成为已稳定的唯一 marker owner，才可创建 `recoveryOtpVerificationAttempt` 和调用 `verifyRecoveryOtp`。

A / B 从空 marker 同时创建 flow 时，固定执行以下有限算法；它不依赖真正 CAS：

```text
1. initial write
   read + validate current marker
   → only absent marker may write own verifying marker
   → setItem(own marker)
   → queueMicrotask / defer one task
   → exact re-read

2. exact re-read
   current === own marker
   → candidate owner；再次 queueMicrotask 后再 exact re-read 一次；
     两次均为 own marker 才允许 provider verify。

   current is valid foreign marker
   → compare local flowId and foreign flowId.

3. deterministic winner
   local flowId > foreign flowId
   → local is loser：不再写 marker，进入 blocked。

   local flowId < foreign flowId
   → local may perform exactly one guarded convergence overwrite：
     overwrite 前必须 re-read，且值仍逐字段等于刚才的 foreign snapshot；
     才可 setItem(own marker)。
     overwrite 后必须 defer + exact re-read：
       - current === own marker：local candidate owner，再做第二次稳定 re-read；
       - current is a lower foreign flow：local loser；
       - current is another higher foreign flow 或无法验证：terminal conflict，local blocked，不再写。

4. terminal condition
   每个 local flow 最多 initial write + one guarded overwrite；不得无限互相覆盖。
   terminal conflict、storage exception 或超过该上限时：当前 tab blocked，
   active=false、settled=true、clear all owned timers、invalidate local request；
   不调用 provider，不进入 password gate，不进入 AppShell。
```

因此不能出现“A 与 B 各自永久认为自己 winner”：任何 privileged transition 前都必须 exact re-read current marker；只有当前 storage 仍等于 own marker、当前 document 仍有 active attempt、且第二次稳定 re-read 也成功的 tab 可继续。后续 `storage` event 一律重新读取 marker：

- current marker 属于更小 foreign flow：本 tab 立即 loser；
- current marker 仍等于 own marker：保持 candidate/owner；
- current marker 是不同更高 flow、无效或读取失败：本 tab terminal blocked/uncertain，不再 overwrite；
- stale event、旧 Promise、旧 timer 只要 flowId/attemptId/markerRevision 不匹配即 no-op。

loser 固定执行：`active=false`、`settled=true`、clear request/evidence/update/signOut timers、invalidate local requestId、忽略后续 stale Promise/event/storage event，并进入 `recovery-blocked`。有效 existing marker 阻止新 flow；只有 marker 已过期且 read-before-remove 确认 storage 仍是同一原记录时，才可删除后开始新 flow。owner 异常关闭只能等 expiry；不得提前接管。

### 4.5 Storage unavailable behavior

- 无 Recovery marker/lock/attempt 且普通 Session 已由 normal controller 安全分类时：普通登录和既有 authenticated AppShell 不因 storage API 不可用而改变。
- 用户尝试开始 Recovery 时：读/写 storage 失败即拒绝 start，返回 `recovery-storage-unavailable`；普通 login 不受影响。
- 存在 marker、lock、attempt、Recovery event，或必须读取 marker 才能安全解释 non-null Session 时：storage failure 为 Recovery-uncertain，`AppShell=false`。observer、duplicated/reloaded document、owner candidate、identity-uncertain document 和 marker ownership-lost document 均不得主动 signOut；只有当前 document 自己的 late successful verify Promise 满足 dedicated local evidence rule 时，才可进行无 marker authority cleanup。

---

## 5. Single controller operations, evidence and timers

`page.tsx` 继续是唯一 controller、唯一 Auth subscription owner。`subscriptionGeneration` 管理 effect；`authRevision` 管理非 `INITIAL_SESSION` event 顺序；action request ID 管理页面操作；marker snapshot revision 管理 storage 变化。它们不得合并。

```ts
type RecoveryOtpVerificationAttempt = {
  flowId: string;
  ownerTabId: string;
  attemptId: number;
  documentGeneration: number;
  baseAuthRevision: number;
  recoveryRevision: number | null;
  markerRevision: number;
  phase: "request-pending" | "awaiting-evidence" | "confirming-session" | "settled";
  active: boolean;
  settled: boolean;
  promiseEvidence: RecoverySessionEvidence | null;
  eventEvidence: {
    user: AuthUser;
    userId: string;
    sessionId: string;
    recoveryRevision: number;
  } | null;
  requestTimeoutId: number | null;
  evidenceTimeoutId: number | null;
  startedAt: number;
};

type RecoveryPasswordUpdateAttempt = {
  flowId: string;
  ownerTabId: string;
  attemptId: number;
  documentGeneration: number;
  baseAuthRevision: number;
  recoveryRevision: number;
  markerRevision: number;
  expectedSessionId: string;
  phase: "updating" | "awaiting-user-updated" | "settled";
  active: boolean;
  settled: boolean;
  promiseEvidence: RecoverySessionEvidence | null;
  eventEvidence: {
    user: AuthUser;
    userId: string;
    sessionId: string;
    recoveryRevision: number;
  } | null;
  timeoutId: number | null;
  startedAt: number;
};

type RecoveryCompletionSignOutOperation = {
  flowId: string | null;
  ownerTabId: string | null;
  requestId: number;
  documentGeneration: number;
  baseAuthRevision: number;
  recoveryRevision: number | null;
  phase: "completion" | "cancel" | "refresh-fail-closed" | "unexpected-fail-closed";
  active: boolean;
  settled: boolean;
  observedSignedOut: boolean;
  promise: Promise<AuthResult<void>>;
  timeoutId: number | null;
  startedAt: number;
};

const recoveryOtpVerificationAttempt = useRef<RecoveryOtpVerificationAttempt | null>(null);
const recoveryPasswordUpdateAttempt = useRef<RecoveryPasswordUpdateAttempt | null>(null);
const recoveryCompletionSignOutOperation = useRef<RecoveryCompletionSignOutOperation | null>(null);
const consumedRecoverySessionIds = useRef<Set<string>>(new Set());
```

### 5.1 create/settle order

1. Factory first rejects observer, no-current-marker, stale markerRevision, active competing operation, inconsistent ownerTabId, invalid/missing Session ID, or a Session ID already present in `consumedRecoverySessionIds`.
2. Verification factory creates its ref object with new monotonic attempt/request ID, current document generation, `active=true`, `settled=false`, then writes required marker phase before provider call. Update factory first atomically consumes the confirmed Recovery Session ID in controller memory, creates the unique update ref with `expectedSessionId`, then writes required marker phase before provider call.
3. Every Promise/event/timer callback first checks reference identity, current document generation, `active`, `!settled`, flowId, attempt/request ID, generation, markerRevision, relevant recoveryRevision, user ID, and where applicable exact Session ID equality.
4. Settle first sets `settled=true`, `active=false`, clears every owned timer, then invalidates ref before state transition / next operation. Old timer cannot touch a new attempt.
5. completion signOut is single-flight: only its factory calls `auth.signOut`; duplicate timeout/Promise/event sees current settled/observed state and no-ops. `SIGNED_OUT` never uses Session ID correlation; it must match its local operation identity and origin.

### 5.2 evidence and exact timeout semantics

- verify starts a 30-second **request watchdog**. If neither Promise success nor `PASSWORD_RECOVERY` arrives, settle local verify failure without signOut because Session evidence does not exist.
- the first valid Promise success with non-empty sessionId **or** a `PASSWORD_RECOVERY` with non-empty sessionId stops request watchdog and starts the 12-second **evidence deadline**. Thus slow network is not destroyed before any evidence exists; once a possible Recovery Session exists, bounded pairing begins.
- verify Promise/event evidence must exactly match current document generation, flow, owner attempt, userId, sessionId and current recoveryRevision. On pair, controller calls bounded one-time `getCurrentUser()` confirmation. Only matching minimal current user and exact current owner marker enter `recovery-password-required`. Duplicate matching `PASSWORD_RECOVERY` is a no-op; a mismatched or missing sessionId never binds a current attempt.
- 12-second expiry, Promise failure after event, user/session mismatch, Session ID extraction failure, Session confirmation failure, marker ownership loss, marker expiry or stale markerRevision settles the attempt. Only when the current document's own verify Promise may have established a Session does it start exactly one `unexpected-fail-closed` cleanup; this cleanup has no marker authority and must not clear a marker.
- update atomically consumes the confirmed Recovery Session ID before calling the adapter and uses a 30-second watchdog. `USER_UPDATED` and update Promise must exactly match the unique active update attempt, expectedSessionId and userId. Any failure, timeout, marker conflict or evidence mismatch forbids retry in that Session and triggers controlled cleanup; only a new Recovery Session can start a new update.
- signOut uses a 15-second watchdog. Current `SIGNED_OUT` wins and settles guest even if Promise later rejects. Promise success fallback settles guest only if `SIGNED_OUT` has not already settled. Failure retains marker/lock and enters fatal retry; retry creates a new completion requestId, never reuses old timer.

---

## 6. Full Recovery-first Auth and lifecycle decision table

All non-`INITIAL_SESSION` Auth events increment `authRevision` before routing. `INITIAL_SESSION` is ignored as identity truth. `storage` / lifecycle events never change AuthUser, invoke normal reconciliation, open AppShell or call signOut by themselves.

| input | no Recovery | owner verifying | owner password-required | owner updating | observer blocked | signout-pending | fatal | corrupt/expired/storage-uncertain |
|---|---|---|---|---|---|---|---|---|
| `INITIAL_SESSION` | ignore | ignore | ignore | ignore | ignore | ignore | ignore | ignore |
| `SIGNED_IN` | normal reconcile | record only; AppShell=false | record only | record only | blocked | no restore | no restore | no restore |
| `TOKEN_REFRESHED` | normal reconcile | record only | record only | record only | blocked | no restore | no restore | no restore |
| `USER_UPDATED` | normal reconcile | ignore for completion | ignore unless no update attempt | only unique active consumed Session + exact expectedSessionId/user ID evidence may proceed | blocked | no normal reconcile | no normal reconcile | no normal reconcile |
| `PASSWORD_RECOVERY` | no valid marker + current document's own verify Promise Session => one no-marker-authority cleanup | bind only exact matching sessionId/user/attempt evidence; duplicate is no-op | duplicate/stale/mismatch no-op | duplicate/stale/mismatch no-op | blocked; never signOut | no-op | no-op | owner/identity uncertain => cleanup only under its dedicated local evidence rule |
| `SIGNED_OUT` | guest | settle only matching local cleanup/guest; clear marker only after local success evidence | guest only if controlled cleanup is current | guest only if controlled cleanup is current | guest convergence; observer did not signOut | idempotent guest | idempotent guest | idempotent guest |
| `storage` marker create/update | no Auth change | re-read/compare | re-read/compare | re-read/compare | stay blocked | no Auth change | no Auth change | re-read; no Auth change |
| `storage` marker remove/expire | no Auth change | settle only under own controlled rules | no direct AppShell | no direct AppShell | wait `SIGNED_OUT` or authoritative current null confirmation | no direct AppShell | no direct AppShell | reclassify; no Auth change |
| `pageshow`/visibility return | no Auth change | revalidate marker/deadline | revalidate marker/deadline | revalidate marker/deadline | revalidate marker | revalidate operation | revalidate operation | re-read; classify uncertainty |
| `pagehide`/unmount | normal cleanup | no React write; marker remains | no React write; marker remains | no React write; marker remains | cleanup listener only | shared operation may settle without React write | cleanup listener only | cleanup listener only |

AppShell is permitted only when:

```text
authState.status === "authenticated"
AND no valid marker
AND no Recovery lock
AND no active verify/update/signOut operation
AND marker storage read and classification succeeded.
```

---

## 7. Startup, refresh and observer bootstrap

Fixed order:

```text
1. obtain/create sessionStorage tabId
2. read and validate marker; capture markerRevision
3. establish Recovery lock / owner-candidate / observer / uncertain classification
4. establish the one Auth subscription
5. re-read marker; if changed, replace startup classification
6. capture initRevision + markerRevision
7. call getCurrentUser()
8. apply only when generation/authRevision/markerRevision still match
```

| startup case | required result |
|---|---|
| no marker + null Session | guest. |
| no marker + normal valid Session + storage usable | existing normal passwordSet mapping. |
| no marker + normal valid Session + storage unavailable | normal login may remain authenticated only because no Recovery signal exists; Recovery start remains disabled. |
| historic owner marker + non-null Session | no in-memory attempt after reload; `recovery-blocked`/fatal without destructive signOut, never owner recovery. |
| foreign marker + non-null Session | `recovery-blocked`; no signOut/takeover/AppShell. |
| foreign marker + null Session | blocked until marker expires/removes **and** current `getCurrentUser()` confirmation remains null. |
| marker corrupt/expired + non-null Session | `recovery-blocked`/fatal; no destructive signOut without the current document's own late-success verify evidence. |
| marker corrupt/expired + null Session | read-before-remove exact invalid record; guest. |
| marker read error + non-null Session with Recovery signal | Recovery-uncertain, AppShell=false; no destructive signOut unless the dedicated own late-success evidence rule applies. |
| concurrent marker change during startup | markerRevision invalidates stale init result; reclassify before any normal mapping. |

---

## 8. Unique Development-only Probe and helper

Scheme B is the only A1.5-R entry: existing `A15SessionProbe.tsx` extends into conceptual owner/observer views within one component. It has no route, no direct Browser Client/adapter import, no second controller/reducer/subscription, no sensitive display/logging and is production inaccessible.

R1 removes `authService.a15-probe.ts` direct Browser Client call and old `redirectTo`. Its only possible retained purpose is a Development guard plus a thin parent-injected facade port; it cannot call Supabase, subscribe, own Recovery state, or form a second path. If R1 Review finds direct parent callbacks equally sufficient, R1 deletes this helper immediately; then R4/R9 omit it. It never remains merely to preserve old behavior.

Future temporary `page.tsx` code is delimited exactly:

```ts
/* A1_5_PROBE_START */
// imports, mount and callbacks used only by A15SessionProbe
/* A1_5_PROBE_END */
```

The permanent Recovery controller must be outside this boundary. R9 may delete only both temporary Probe files that still exist and this delimited block; it may not revert any permanent controller line.

---

## 9. Exact Batch cards R1–R10

### R1 — Historical / Completed: Recovery facade baseline

> **状态：** 已完成、Review、提交并 Push，正式关闭。以下记录只保留历史范围、验证与回退信息；不是当前授权入口，也不会由本次 Review 再次授权。

1. **Historical enter condition:** 已满足；R1 已关闭，不再作为当前 action 或 ChatGPT gate。
2. **Allowed files:** `apps/mobile-app/types/app.ts`; `apps/mobile-app/services/authService.ts`; `apps/mobile-app/services/authService.real.ts`; `apps/mobile-app/services/authService.mock-adapter.ts`; `apps/mobile-app/lib/auth-errors.ts`; `apps/mobile-app/services/authService.a15-probe.ts`。
3. **New files:** 无；R1 不创建文件。
4. **Temporary files:** `apps/mobile-app/services/authService.a15-probe.ts`；仅在删除/替换 helper import 绝对必要时的 `apps/mobile-app/components/auth/A15SessionProbe.tsx` 与 `apps/mobile-app/app/page.tsx` future boundary block。
5. **Permanent files:** `apps/mobile-app/types/app.ts`; `apps/mobile-app/services/authService.ts`; `apps/mobile-app/services/authService.real.ts`; `apps/mobile-app/services/authService.mock-adapter.ts`; `apps/mobile-app/lib/auth-errors.ts`。
6. **Forbidden files:** `apps/mobile-app/lib/recovery-marker.ts`; `apps/mobile-app/components/auth/OtpLoginPage.tsx`; `apps/mobile-app/components/auth/PasswordLoginPage.tsx`; `apps/mobile-app/components/auth/RegisterPage.tsx`; `apps/mobile-app/package.json`; `apps/mobile-app/package-lock.json`; `src/**`; Gateway; environment; Supabase; Email Template。
7. **Implementation steps:** 添加三 facade action/types/error contract；Real adapter 使用精确 Recovery OTP calls；Mock adapter 仅最小内存行为；移除 helper 的 `redirectTo` 与 direct Supabase call，或删除 helper。R3 的 Session ID Evidence Contract 在本 card 后通过批准的 extension 实现，不能被描述为 R1 重做。
8. **Static validation:** TypeScript contract、source search 无 active `redirectTo` Recovery call、唯一 Browser Client/subscription、无敏感日志。
9. **Manual validation:** 不运行浏览器、OTP、Recovery 或平台操作；仅检查静态 contract/harness 接口。
10. **Claude Code Review gate:** 审阅 R1 exact diff、facade direction、adapter call shape 与 helper 是否完全移除第二路径。
11. **Historical gate:** R1 已关闭；后续当前门禁以顶部阶段账本与 R3 card 为准。
12. **Rollback:** 仅经授权逐路径回退本 card 的 allowed paths；不得恢复 link-based Recovery。
13. **Stop condition:** 需要 marker/controller/formal UI/package/lockfile/Gateway/platform变更，或产生第二 client/subscription 时立即停止。
14. **Historical next:** 无；R2 已关闭，R3 是唯一待审文档阶段。

### R2 — Historical / Completed: marker helper

> **状态：** 已完成、Review、提交并 Push，正式关闭。以下记录只保留历史范围、验证与回退信息；不是当前授权入口。

1. **Historical enter condition:** 已满足；R2 已关闭，不再作为当前 action 或 ChatGPT gate。
2. **Allowed files:** `apps/mobile-app/types/app.ts`（仅 marker schema type 必须共享时）。
3. **New files:** `apps/mobile-app/lib/recovery-marker.ts`。
4. **Temporary files:** 无；R2 不创建或修改 temporary Probe/page code。
5. **Permanent files:** `apps/mobile-app/lib/recovery-marker.ts` 与允许时的 `apps/mobile-app/types/app.ts` shared marker type。
6. **Forbidden files:** `apps/mobile-app/app/page.tsx`; `apps/mobile-app/services/authService.ts`; `apps/mobile-app/services/authService.real.ts`; `apps/mobile-app/services/authService.mock-adapter.ts`; `apps/mobile-app/lib/auth-errors.ts`; `apps/mobile-app/components/auth/A15SessionProbe.tsx`; `apps/mobile-app/services/authService.a15-probe.ts`; formal Auth pages; package/lockfile; `src/**`; Gateway/platform files。
7. **Implementation steps:** 六字段 schema、strict parse、absolute expiry、read-before-remove、non-CAS compare/write/re-read、conflict classification；不调用 React/Supabase。
8. **Static validation:** serialization/parser fixtures、extra field rejection、expiry/corruption/clock rollback/non-CAS conflict unit harness；检查无 forbidden field。
9. **Manual validation:** 不运行浏览器、OTP、Recovery 或平台操作；人工审阅 helper API 与 fixture results。
10. **Claude Code Review gate:** 审阅 helper 独立性、无 client/subscription/React、严格字段和 bounded conflict algorithm。
11. **Historical gate:** R2 已关闭；R3 的当前文档门禁见顶部阶段账本。
12. **Rollback:** 仅经授权删除 `apps/mobile-app/lib/recovery-marker.ts` 或回退允许的 shared type。
13. **Stop condition:** helper 需要 controller、Browser Client、subscription、Probe UI 或额外文件时立即停止。
14. **Historical next:** 无；R3 Session ID Evidence Contract 文档修订等待 ChatGPT Review。

### R3 — Session ID Evidence Contract extension and permanent single controller protocol

1. **Enter condition:** R1、R2 均已关闭；R3 Evidence Contract 三文档完整 Review 已通过；ChatGPT 已判断三文档允许提交；用户已确认三文档提交；三份文档已精确提交并确认提交成功；staged 已恢复为空；R3 代码及其他文件未进入该文档提交；且 ChatGPT 已明确授权 R3 五文件施工。缺少任一条件不得进入代码施工。
2. **Allowed files:** `apps/mobile-app/types/app.ts`; `apps/mobile-app/services/authService.ts`; `apps/mobile-app/services/authService.real.ts`; `apps/mobile-app/services/authService.mock-adapter.ts`; `apps/mobile-app/app/page.tsx`。
3. **New files:** 不新增文件。
4. **Temporary files:** `apps/mobile-app/app/page.tsx` 中未来由 `/* A1_5_PROBE_START */` 至 `/* A1_5_PROBE_END */` 包围的边界注释本身及其仅 Probe import/mount/callback 区域属于 temporary page code；R3 只可在不存在时插入这对边界，不得把永久 controller 放入其中。该 temporary page code 由 R9 删除。
5. **Permanent files:** `apps/mobile-app/types/app.ts` 的 evidence types；`apps/mobile-app/services/authService.ts` 的 facade contract；`apps/mobile-app/services/authService.real.ts` 的私有同步 Session ID extraction / event mapping；`apps/mobile-app/services/authService.mock-adapter.ts` 的唯一 mock Session record；`apps/mobile-app/app/page.tsx` 边界外的 Recovery controller。
6. **Forbidden files:** `apps/mobile-app/lib/auth-errors.ts`; `apps/mobile-app/lib/recovery-marker.ts`; `apps/mobile-app/lib/recovery-marker.test.ts`; `apps/mobile-app/lib/supabase-client.ts`; `apps/mobile-app/components/auth/A15SessionProbe.tsx`; `apps/mobile-app/services/authService.a15-probe.ts`; `apps/mobile-app/components/auth/OtpLoginPage.tsx`; `apps/mobile-app/components/auth/PasswordLoginPage.tsx`; `apps/mobile-app/components/auth/RegisterPage.tsx`; `apps/mobile-app/package.json`; `apps/mobile-app/package-lock.json`; `src/**`; Gateway/platform files.
7. **Implementation steps:**
   - `types/app.ts`：新增 `RecoverySessionEvidence`、`AuthSessionEvent.sessionId`、`UpdateRecoveryPasswordInput.expectedSessionId` 与仅供 R3 的 operation evidence types；不得包含 token 或 provider payload。
   - `authService.ts`：更新 Recovery facade signatures；unavailable facade 保持 typed fail-closed；不得解码 JWT 或创建第二 client。
   - `authService.real.ts`：在私有同步边界提取格式正确的 Session ID；verify/update 输出 user + sessionId；update 执行 pre/post Session consistency；subscription 输出 sessionId；不得暴露 JWT、不得在 callback 调 `getClaims()`、不得创建第二 subscription。
   - `authService.mock-adapter.ts`：扩展既有唯一 mock Session record；每个 Recovery verify 生成新 Session ID；PASSWORD_RECOVERY / TOKEN_REFRESHED / USER_UPDATED 复用对应 ID；新 Recovery Flow 生成不同 ID；SIGNED_OUT 为 null；不持久化 token/OTP/password，不创建第二 Session store。
   - `page.tsx`：以 exact Session ID 配对 verify Promise / PASSWORD_RECOVERY、重复 PASSWORD_RECOVERY 幂等、每 Session 一次 update、以 expectedSessionId 配对 update Promise / USER_UPDATED、重复 USER_UPDATED 幂等、marker ownership loss 后撤销 destructive authority、完整 Strict Mode settlement 与 AppShell fail-closed；保持唯一 client、唯一 subscription、唯一 Controller 与唯一 AppShell。
8. **Static validation:** controller harness 验证 Session ID match/mismatch、old Flow event → new Flow Promise 拒绝、duplicate PASSWORD_RECOVERY / USER_UPDATED no-op、one-update-per-Session、no duplicate signOut、foreign marker authority revocation、stale event/timer 拒绝、single subscription、永久代码不在 boundary 内；adapter source 验证 token 不离开 Real adapter、无 callback `getClaims()`。
9. **Manual validation:** 不运行真实 OTP；仅使用 R3 允许的受控无网络 contract/controller harness。
10. **Claude Code Review gate:** Review exact R3 diff、contract direction、private extraction boundary、mock semantics、operation ownership、single client/subscription、Strict Mode settlement 与 AppShell gate。
11. **Exit condition:** R3 五文件工作完成后，必须通过独立安全 Review、ChatGPT 最终判断与用户确认 R3 代码提交，才可精确提交 R3 代码；文档 Review 或本 card 完成均不自动授权 R4。
12. **ChatGPT gate:** 仅在 R3 代码已按上述门禁完成后，才可决定是否授权 R4。
13. **Rollback:** 仅经授权逐路径回退本 card 的 permanent paths 或删除该 temporary boundary；不得回滚整个 `page.tsx`。
14. **Stop condition:** R3 三文档未完整 Review、未获 ChatGPT 文档提交判断、未获用户确认、未精确提交或未确认提交成功、staged 未恢复为空，或 R3 代码及其他文件已进入文档提交时，均不得进入 R3；此外 token/JWT 进入 facade 或 Controller；sessionId 进入 marker/storage/log/error/UI；async Auth call 造成 callback reentry；旧 Flow event 可绑定新 Flow；同 Session 第二 update；marker ownership loss 后仍启动 owner completion signOut；Strict Mode cleanup 留下 active operation；需要正式 UI、第二 client/subscription、Gateway、package/lockfile 或 boundary 外临时 Probe 扩展时立即停止。
15. **Next:** R4 不自动开始。

### R4 — existing Probe only

1. **Enter condition:** R3 已通过 Claude Code Review，ChatGPT 明确授权 R4。
2. **Allowed files:** `apps/mobile-app/components/auth/A15SessionProbe.tsx`; `apps/mobile-app/app/page.tsx` 中 `A1_5_PROBE_START/END` 之间文本；`apps/mobile-app/services/authService.a15-probe.ts`（仅 R1 未删除且仍存在）。
3. **New files:** 无；R4 不创建文件。
4. **Temporary files:** 所有 R4 allowed paths/blocks 都是 temporary，R9 删除。
5. **Permanent files:** 无；R4 不修改 permanent controller/facade/marker logic。
6. **Forbidden files:** `apps/mobile-app/types/app.ts`; `apps/mobile-app/services/authService.ts`; `apps/mobile-app/services/authService.real.ts`; `apps/mobile-app/services/authService.mock-adapter.ts`; `apps/mobile-app/lib/auth-errors.ts`; `apps/mobile-app/lib/recovery-marker.ts`; formal Auth pages; package/lockfile; `src/**`; Gateway/platform files。
7. **Implementation steps:** owner/observer conceptual Probe controls及 controlled test harness ports；无 direct client/provider call、reducer、subscription、敏感状态。
8. **Static validation:** Development guard/source scan、Probe 不 import adapter/client、boundary 内外 diff separation。
9. **Manual validation:** controlled no-network harness only；不运行真实 OTP/Recovery/browser平台操作。
10. **Claude Code Review gate:** 审阅 temporary-only scope、no second path、no sensitive display/log。
11. **ChatGPT gate:** 仅可决定是否授权 R5。
12. **Rollback:** 仅经授权删除/回退 R4 的 allowed temporary files/block。
13. **Stop condition:** 需要新 file、route、formal UI、permanent controller modification、direct provider/client或第二 subscription时立即停止。
14. **Next:** R5 不自动开始。

### R5 — static engineering review

1. **Enter condition:** R4 已通过 Claude Code Review，且 ChatGPT 明确授权 R5。
2. **Allowed files:** 无；本 Batch 不允许编辑仓库文件。
3. **New files:** 无；本 Batch 不允许创建仓库文件。
4. **Temporary files:** 无新增 temporary file；只观察 R1–R4 已存在的 temporary Probe paths。
5. **Permanent files:** 无新增 permanent file；只观察 R1–R3 已授权 permanent paths。
6. **Forbidden files:** `apps/mobile-app/**`; `src/**`; `docs/**`; package/lockfile; env; Gateway; Supabase; Email Template；任何外部配置。
7. **Implementation steps:** 执行 TypeScript（mobile build）、lint、build、diff check、exact scope、secret scan、single client/subscription scan、AppShell/static Probe boundary review。
8. **Static validation:** `npm run lint`、`npm run build`、`git diff --check`、exact-file diff、sensitive scan、single client/subscription search。
9. **Manual validation:** 无浏览器、OTP、Recovery 或平台操作；只人工审阅命令输出与静态报告。
10. **Claude Code Review gate:** 审核所有静态证据与 R1–R4 范围。
11. **ChatGPT gate:** 仅可独立决定是否授权 R6a；R6b、R7、R8 不自动授权。
12. **Rollback:** 无修改可回退。
13. **Stop condition:** 任一静态检查失败、范围越界、敏感扫描命中、第二 client/subscription 或 AppShell gate 缺口即停止。
14. **Next:** R6a 不自动开始。

### R6 — two separately authorized external gates

#### R6a — Development Reset Password template gate

1. **Enter condition:** R5 已通过，ChatGPT 明确授权**仅** Development Reset Password template 变更。
2. **Allowed files:** 无；不允许修改仓库文件。
3. **New files:** 无；不允许创建仓库文件。
4. **Temporary files:** 无。
5. **Permanent files:** 无。
6. **Forbidden files:** `apps/mobile-app/**`; `src/**`; `docs/**`; package/lockfile; env; Gateway；所有非 `qingxing-dev` Reset Password Email Template；Login OTP/Magic Link、registration confirmation、email-change templates。
7. **Implementation steps:** 仅将 `qingxing-dev` Reset Password template 设置为本计划的 `{{ .Token }}` 目标文本。
8. **Static validation:** 不适用；仓库 diff 必须无新文件，配置记录不得含 key/token/Cookie。
9. **Manual validation:** 用户或 Claude Code 记录模板类别与 `{{ .Token }}` placeholder 的非敏感确认；不得发送 OTP。
10. **Claude Code Review gate:** 只审阅模板类别/placeholder 证据和仓库零 diff。
11. **ChatGPT gate:** ChatGPT 独立决定是否授权 R6b；R6a 通过不授权真实 Recovery。
12. **Rollback:** 仅经新授权恢复该同一 Development Reset Password template；不得修改其他模板。
13. **Stop condition:** 错误项目、错误模板类别、出现 ConfirmationURL/token_hash、无法给出非敏感确认或任何仓库文件变化即停止。
14. **Next:** R6b 不自动开始。

#### R6b — real owner single-tab Recovery test

1. **Enter condition:** R6a 已确认，专用 Development 测试邮箱可用，ChatGPT 明确授权真实 Recovery run。
2. **Allowed files:** 无；不允许修改仓库文件。
3. **New files:** 无；不允许创建仓库文件。
4. **Temporary files:** 无新增；只观察 R1–R4 已授权 temporary Probe paths。
5. **Permanent files:** 无新增；只观察已授权 facade/controller/marker paths。
6. **Forbidden files:** `apps/mobile-app/**`; `src/**`; `docs/**`; package/lockfile; env; Gateway; Supabase 配置；Email Template；非授权测试账号。
7. **Implementation steps:** 从 `http://qingxing.localhost:3002` 使用 dedicated Development mailbox 完成 owner request/verify/update/local signOut 运行证据。
8. **Static validation:** 核验 source 无 redirectTo/link recovery；运行前 exact Git scope、single client/subscription、AppShell gate 静态证据仍通过。
9. **Manual validation:** 记录 Promise / PASSWORD_RECOVERY Session ID equality、TOKEN_REFRESHED / USER_UPDATED continuity、new Recovery Session difference、SIGNED_OUT null Session、AppShell=false、local signOut、相对 `/api/auth/me=null` 的非敏感 Browser/Network 证据。
10. **Claude Code Review gate:** 审阅真实 owner 单标签证据和失败停止证据。
11. **ChatGPT gate:** 仅可决定是否授权 R7。
12. **Rollback:** 无仓库/配置改动可回退；测试失败仅停止并保留非敏感证据。
13. **Stop condition:** OTP/Session/evidence/AppShell/signOut/API 任一失败、跨域、敏感日志、第二 client/subscription 或未授权平台动作即停止。
14. **Next:** R7 不自动开始。

### R7 — observer, clone, storage and refresh runtime evidence

1. **Enter condition:** R6b 已通过 Claude Code Review，ChatGPT 明确授权 R7。
2. **Allowed files:** 无；不允许修改仓库文件。
3. **New files:** 无；不允许创建仓库文件。
4. **Temporary files:** 无新增；只观察已存在 `apps/mobile-app/components/auth/A15SessionProbe.tsx`、保留时的 `apps/mobile-app/services/authService.a15-probe.ts` 与 `app/page.tsx` 的 `A1_5_PROBE_START/END` block。
5. **Permanent files:** 无新增；只观察 `app/page.tsx` 边界外 controller、`types/app.ts` 与 `lib/recovery-marker.ts`。
6. **Forbidden files:** `apps/mobile-app/**`; `src/**`; `docs/**`; package/lockfile; env; Gateway; Supabase; Email Template；任何外部配置。
7. **Implementation steps:** 使用已授权 runtime harness 验证 observer bootstrap、duplicated-tab sessionStorage、simultaneous flow conflict、stale event、owner refresh、abnormal close、expiry、clock/sleep restore、storage unavailable/corrupt marker 和 signOut failure。
8. **Static validation:** 重查 no-CAS algorithm、timer identity guards、owner-only factories、observer signOut counter wiring 与 exact source boundaries。
9. **Manual validation:** 在 Browser Origin 使用专用 Development Profiles/tabs；每个 scenario 记录非敏感 event/state/header evidence。
10. **Claude Code Review gate:** 审阅 one-owner convergence、observer no-signOut、timer cleanup、expiry/fail-closed runtime evidence。
11. **ChatGPT gate:** 仅可决定是否授权 R8。
12. **Rollback:** 无仓库/配置改动可回退；运行失败只停止。
13. **Stop condition:** 双 owner、无限 overwrite、observer signOut/takeover、expired flow grant、stale timer write、Session/AppShell leak 或未授权外部修改即停止。
14. **Next:** R8 不自动开始。

### R8 — normal OTP, Profile, Cookie and cache evidence

1. **Enter condition:** R7 已通过 Claude Code Review，ChatGPT 明确授权 R8。
2. **Allowed files:** 无；不允许修改仓库文件。
3. **New files:** 无；不允许创建仓库文件。
4. **Temporary files:** 无新增；只观察既有 A15 Probe facade ports 与已授权 A1.5 temporary paths。
5. **Permanent files:** 无新增；只观察 facade、Real adapter、controller、marker helper 与 root `/api/auth/me` 行为。
6. **Forbidden files:** `apps/mobile-app/**`; `src/**`; `docs/**`; package/lockfile; env; Gateway; Supabase; Email Template；任何外部配置。
7. **Implementation steps:** 验证 facade-level `sign-in` `shouldCreateUser:false` / unknown non-creation，`sign-up` `true` / Session creation，current user ID/API match，Profile A/B isolation、same-profile SIGNED_OUT、Cookie/header/cache evidence。
8. **Static validation:** 检查 normal intents、relative `/api/auth/me`、single client/subscription、source 中无 secret/link recovery。
9. **Manual validation:** 从 Browser Origin 运行 normal OTP/Profile/cache cases，记录 HTTP status/header names、minimal ID match、无 Set-Cookie reuse 的非敏感证据。
10. **Claude Code Review gate:** 审阅 normal OTP provider/controller/cookie gate 与 Profile/cache evidence。
11. **ChatGPT gate:** 仅可决定是否授权 R9。
12. **Rollback:** 无仓库/配置改动可回退；任一运行失败只停止。
13. **Stop condition:** sign-in 自动建号、sign-up 未建 Session、ID mismatch、跨 Profile leak、shared cache、Cookie header loss、Set-Cookie reuse 或未授权外部修改即停止。
14. **Next:** R9 不自动开始。

### R9 — temporary Probe deletion

1. **Enter condition:** R8 已通过 Claude Code Review，ChatGPT 明确授权 R9。
2. **Allowed files:** `apps/mobile-app/components/auth/A15SessionProbe.tsx`; `apps/mobile-app/services/authService.a15-probe.ts`（仅当 R1 未删除且仍存在）; `apps/mobile-app/app/page.tsx` 中从 `A1_5_PROBE_START` 到 `A1_5_PROBE_END` 的完整边界 block。
3. **New files:** 无。
4. **Temporary files:** 上述两临时文件及该 page boundary block；本 Batch 只删除这些临时内容。
5. **Permanent files:** `apps/mobile-app/app/page.tsx` 边界外 Recovery controller、`apps/mobile-app/types/app.ts`、`apps/mobile-app/lib/recovery-marker.ts`、facade/adapters 均永久保留且不得删除。
6. **Forbidden files:** 所有其他 `apps/mobile-app/**` 路径；`src/**`; `docs/**`; package/lockfile; env; Gateway; Supabase; Email Template；整文件回滚 `app/page.tsx`。
7. **Implementation steps:** 删除 allowed temporary files/block，重新 production build，再执行精确 source/build scans。
8. **Static validation:**
   - **Source scan roots only:** `apps/mobile-app/app/**`, `apps/mobile-app/components/**`, `apps/mobile-app/services/**`, `apps/mobile-app/lib/**`, `apps/mobile-app/types/**`。
   - **Source scan exclusions:** `docs/**`, `.git/**`, review artifacts, plan files, Execution Plan 本身。
   - **Build scan root only:** 新建的 `apps/mobile-app/.next/**`。
   - **keywords:** `A15SessionProbe`, `authService.a15-probe`, `A1_5_PROBE_START`, `A1_5_PROBE_END`, `D1`, `temporary probe markers`。
   - Execution Plan 自身含这些文字不影响结果；上述 source roots 或 `.next/**` 命中任一 keyword 即 R9 failed。
9. **Manual validation:** production build 页面中无 Probe UI、无 Probe route/URL entry；现有正式 Auth 页面仍是唯一产品入口。
10. **Claude Code Review gate:** 审阅 delete diff、精确 scan roots/exclusions、build 输出和 permanent controller preservation。
11. **ChatGPT gate:** 仅可决定是否授权 R10。
12. **Rollback:** 仅经授权恢复本 card 列出的临时 files/block；不得恢复已删除的旧 link Recovery 语义或整体 page 文件。
13. **Stop condition:** production source/build artifact 命中任一 keyword、permanent controller 被删除、正式 Auth 页面受影响、scan root 外文件变化或 build 失败即停止。
14. **Next:** R10 不自动开始。

### R10 — A1.5-R final gate

1. **Enter condition:** R9 deletion Review 已通过，ChatGPT 明确授权 R10。
2. **Allowed files:** 无；不允许修改仓库文件。
3. **New files:** 无；不允许创建仓库文件。
4. **Temporary files:** 无；R9 后不应存在 A15 temporary Probe file 或 page boundary block。
5. **Permanent files:** 无新增；只审阅 R1–R3 已授权 permanent files。
6. **Forbidden files:** `apps/mobile-app/**`; `src/**`; `docs/**`; package/lockfile; env; Gateway; Supabase; Email Template；任何外部配置。
7. **Implementation steps:** 汇总 Recovery/observer、normal OTP/provider、Profile/cache/API、deletion、Git scope 与 35-row matrix evidence。
8. **Static validation:** staged empty、`git diff --check`、exact-file diff、R9 scans、single client/subscription、AppShell gate、no secret/log scan。
9. **Manual validation:** 复核每个 matrix row 的 prerequisite/harness/expected/failure/evidence 已有非敏感记录，不补发 OTP 或修改平台。
10. **Claude Code Review gate:** 输出 A1.5-R final Review，确认无 P0/P1 blocking finding。
11. **ChatGPT gate:** ChatGPT 单独决定是否允许后续 A2 计划/授权；R10 不授权 A2。
12. **Rollback:** 无仓库/配置改动可回退；发现缺口只停止并回到对应 Batch 的计划修订。
13. **Stop condition:** 任一 matrix 缺证、Probe artifact、Git 范围越界、P0/P1、安全/缓存/Session failure 或未授权动作即停止。
14. **Next:** A2 不自动开始。

---

## 10. Template and local topology

Future template target only, not current authorization:

```html
<h2>重置你的清行密码</h2>
<p>这是清行密码重置验证码。</p>
<p>请回到清行，在密码找回页面填写下面的验证码：</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 8px;">
  {{ .Token }}
</p>
<p>如果不是你本人操作，可以忽略这封邮件。</p>
```

Locked local topology:

```text
Browser Origin:  http://qingxing.localhost:3002
listener only:   127.0.0.1:3002
mobile upstream: http://127.0.0.1:3001
root upstream:   http://127.0.0.1:3000
/ → mobile
/api/auth/me → root, requested relatively from Browser Origin
```

Future authorized PowerShell runbook uses `Get-NetTCPConnection -LocalPort 3000,3001,3002`, root `npm run dev -- --hostname 127.0.0.1 --port 3000`, mobile equivalent on 3001, and only user-confirmed existing external Gateway command. No Gateway config may be created/edited. Browser Cookie/Profile/cache evidence never uses bare listener/upstreams.

---

## 11. Validation matrix

每行均为独立 gate。非敏感证据只能是 status/event 顺序、Browser Origin、HTTP status/header names、marker 字段名、source/build scan count、controller counter 或截图引用；绝不记录 email、OTP、password、token、Cookie 或 Session value。

| # | 前置条件 | Harness / 操作输入 | 期望状态 | 失败判断 | 非敏感证据 |
|---:|---|---|---|---|---|
| 1 | R6b 测试邮箱 | 调用 `sendRecoveryOtp` | 中性 request 结果；不建 Session/marker | raw provider error 或提前 Session | facade result code、event count |
| 2 | known/unknown 测试邮箱 | 分别请求 Recovery | 不枚举账号；页面/Probe 中性 | 账号存在性文案/状态泄露 | UI copy screenshot、result category |
| 3 | 当前六位 Token | owner verify 当前 Token | Promise / PASSWORD_RECOVERY 的 user ID + non-empty sessionId 均精确匹配才可继续 | 单一 evidence、sessionId 缺失/不匹配或旧 Flow event 打开 gate | event/Promise order、session-match boolean |
| 4 | 错误 code | 输入 controlled wrong code | 无 Session/gate，local form 可重试 | AuthState/AppShell 改变 | status、error code |
| 5 | 过期 code | 输入过期 code | 无 owner authority | password-required/AppShell | status、error code |
| 6 | resend 后旧 code | 新 request 后提交旧 code | old flow/attempt 无效 | old code 写当前 flow | flow/attempt ID match boolean |
| 7 | controller harness | Promise success 后注入 matching user ID + sessionId event | 事件前保持 verifying | Promise 单独进入 gate | state timeline、session-match boolean |
| 8 | controller harness | 先注入 matching user ID + sessionId event，再 Promise success | Promise 前保持 verifying | event 单独进入 gate | revision/evidence timeline、session-match boolean |
| 9 | controller harness | 对同一 attempt 注入 duplicate matching event | 一次 evidence/transition，duplicate no-op | 第二 gate/signOut/getCurrentUser | transition、signOut、getCurrentUser counters |
| 10 | first evidence 已到 | 不提供第二 evidence，推进 12 秒 clock | 一次无 marker authority fail-closed cleanup；不清 marker | password gate、多次 signOut 或 marker 被清 | timeout ID、signOut counter、marker state |
| 11 | verify request pending | 不提供任何 evidence，推进 30 秒 clock | local verify failure，不 signOut | signOut 或 active attempt 残留 | status、operation counter |
| 12 | paired evidence + current user | `getCurrentUser` 返回 matching minimal user，marker 真实重读仍为 exact owner | owner password-required，AppShell=false | ID/session/marker mismatch 或 null 后仍 gate | user-ID/session/marker equality boolean、render state |
| 13 | foreign valid marker | 第二 tab 启动/收到 marker | recovery-blocked | password UI/update/takeover | render state、operation counters |
| 14 | observer tab | owner 完成或发生 recovery event | observer signOut counter 恒为零 | observer 调用 signOut | observer counter |
| 15 | owner password-required | update Promise + matching expectedSessionId/user ID `USER_UPDATED` | 一次 completion signOut | ordinary authenticated/AppShell | event order、session-match、counter |
| 16 | update failure before TTL | 尝试同 Session retry | 拒绝第二 update；受控 cleanup；仅新 Recovery Session 可新 update | 新 attempt ID / 旧 result 覆盖新 attempt | consumed-session、timer、signOut counters |
| 17 | non-owner/stale/old-session update | 注入 foreign、stale 或 sessionId mismatch `USER_UPDATED` | 不完成、不 signOut | foreign update 完成 flow | owner/session match boolean |
| 18 | completion operation | local signOut Promise/event 成功 | guest 后才由 exact owner completion 清 marker | marker 先清、foreign marker 清除或重复 cleanup | marker phase、signOut count |
| 19 | completion failure harness | signOut error/15s timeout | fatal lock/marker retained；新 request retry | guest/AppShell 或复用旧 request | status、request ID |
| 20 | historical owner marker + Session | reload owner document | `recovery-blocked` / fatal without destructive signOut；不恢复 owner、也不清/覆盖 marker；等待 `SIGNED_OUT` 或权威 current Session=null 收敛 | password UI/owner restore/marker removal/refresh signOut | startup state、counter、marker state |
| 21 | foreign marker + Session | 新 observer document load | blocked，不 signOut | normal reconcile/AppShell | render state、counter |
| 22 | active owner closes | close owner / start new observer | marker 保留至 expiry，无接管 | observer becomes owner | marker presence、observer state |
| 23 | active marker near TTL | advance deadline in each phase | owner cleanup；null Session stale marker安全移除 | TTL 后仍 owner/gate | expiry timestamp、operation counter |
| 24 | malformed/extra-field fixture | helper parse/read | marker invalid，AppShell=false | malformed marker accepted | parser result、field-name list |
| 25 | storage-throw fixture | normal no-Recovery login then Recovery start | normal defined；Recovery start blocked | normal state ambiguity/Recovery start | status、error code |
| 26 | duplicated browser tab | copy sessionStorage after owner verify starts | clone lacks memory attempt，blocked | second owner/update/signOut | attempt existence、render state |
| 27 | interleaved A/B harness | both read empty/write own/defer/re-read | bounded winner; loser settled/timers cleared | dual winner/infinite overwrite | write count、winner/loser IDs |
| 28 | Profile A/B sessions | A local signOut | A null；B unchanged | cross-profile Session effect | per-profile API status |
| 29 | same Profile two tabs | A local signOut | B gets SIGNED_OUT→guest | B stays authenticated or self-signOut | event/state timeline |
| 30 | known/unknown normal sign-in | facade `sendOtp({intent:"sign-in"})` | shouldCreateUser=false；unknown not created | auto account creation | adapter option/result evidence |
| 31 | normal sign-up email | facade `sendOtp({intent:"sign-up"})` + verify | shouldCreateUser=true；Session created | no Session/wrong intent | adapter option/event evidence |
| 32 | normal OTP then signOut | relative `/api/auth/me` before/after | null → matching minimal ID → null | mismatch/cache stale | HTTP status and ID-match boolean |
| 33 | Browser Origin gateway | inspect auth/API headers across profiles | forwarding + private/no-store equivalent/no reuse | missing header/shared cache/Set-Cookie reuse | header names/values class |
| 34 | delayed-init and Strict Mode harness | delay init; inject event/storage change; replay effect | stale init discarded; one subscription/listener/timer/op；cleanup 留下零 active verify/update/completion op | stale write/duplicate operation/active completion after cleanup | revision/generation/counter evidence |
| 35 | R9 production rebuild | perform exact R9 source/build scan | only six marker fields; zero Probe artifacts | forbidden sensitive/probe keyword match | scan roots, exclusion list, match counts |
| 36 | Real adapter contract harness | successful Session / malformed JWT payload / absent claim | only valid `session_id` maps to `sessionId`; failure is typed fail-closed; raw JWT never crosses adapter | token/payload leaks, async callback reentry or correlation admission on failure | result category、source scan count |
| 37 | controller harness | old Flow `PASSWORD_RECOVERY` sessionId then new Flow verify Promise sessionId | old event cannot bind / admit new Flow | user-ID-only match admits | flow/session match booleans、state timeline |
| 38 | controller harness | same Session duplicate / delayed `USER_UPDATED` after consumed update | no second update, no second completion signOut | second update or stale event consumes new operation | consumed-session、update/signOut counters |
| 39 | controller harness | foreign/absent/invalid/storage-unavailable marker after owner evidence | revoke destructive owner authority; blocked/fatal; no foreign clear/overwrite | normal update or owner completion signOut starts | marker status、operation counters |
| 40 | real R6b prerequisite | Recovery verify / TOKEN_REFRESHED / USER_UPDATED / new Recovery verify / SIGNED_OUT | verify Promise/event same Session ID; refresh and update retain it; new verify differs; SIGNED_OUT accepts null | any invariant assumed without evidence | non-sensitive equality booleans/event order |

---

## 12. Engineering, deletion, A2 and A3 gates

Every code Batch requires mobile TypeScript via `npm run build`, `npm run lint`, `npm run build`, `git diff --check`, exact diff, staged set check, sensitive source/bundle/log scan, unique client/subscription scan, AppShell gate review and Development-only reachability review. R9 additionally requires production build rebuild followed by source and `.next` scans.

A2 only covers ordinary sign-in/sign-up OTP pages, intent, resend, mapped errors and Back behavior. It does not alter Recovery protocol or add Recovery UI. A3 only after A2 may add PasswordLogin “忘记密码？” entry, `ForgotPasswordPage.tsx`, formal Recovery email/code/password UI, password update and password-login return; it must reuse this controller protocol and cannot create a second controller/client/subscription.

Current state is not commit-ready. Future commit requires completed authorized work, deletion of all temporary Probe artifacts, final Claude Code Review, lint/build/diff success, exact Git scope, ChatGPT approval and explicit per-file staging. `git add .`, `git add -A`, `git add -N` are prohibited.

---

## 13. Current next step

1. ChatGPT completes the R3 Session ID Evidence Contract 三文档 Review。
2. 仅在 Review 通过后，ChatGPT 判断三文档可以提交，用户确认提交，并精确暂存和提交这三份文档；确认文档提交成功、staged 已为空，且 R3 代码及其他文件未进入该文档提交后，才可由 ChatGPT 单独决定是否授权 R3 五文件 `R1 Contract Extension + R3 Controller Consumption` 施工。
3. 文档 Review 通过不等于 R3 代码自动获得施工授权。代码、template、Gateway、real OTP、A1.5-R、A2、Codex、暂存、commit 和 push 均继续受各自门禁约束。
