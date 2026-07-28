# qa-report-logic — expo-updates OTA (qa-logic)

> 대상: `plan.md`(§3 계약·§4 두 축 우선순위·§5 인수조건·§5-1 테스트·§6 엣지케이스·§7 경계면) · `dev-notes.md`(§2 매핑 11행·§4 이탈 결정·§6 라이브 이월).
> 범위: **로직·통합 정합성·보안/비용 가드레일·TDD·컨벤션·문서 정합.** 비주얼 충실도는 qa-visual 소관(본 리포트 제외 — `OtaReadyDialog`의 색·간격·카피 톤은 다루지 않고, **콜백 배선·testID·props 계약만** 본다).
> 검증 방식: 생산자↔소비자 **양쪽 동시 읽기** + 전수 grep + 테스트 **재실행**(9회) + 문서 교차 대조. **코드 수정 0 · git 명령 0 · 시크릿 접근 0.**

## 종료 판정: ✅ **통과**

인수조건 T1~T10 전부 근거 확인. **기능 결함(중/고) 0건.** 아래 [저]·[정보] 4건은 권고 사항이며 스프린트를 막지 않는다.
단, **이 스프린트의 실제 동작은 L1~L8(+제안 L9)이 라이브에서 실증되기 전까지 무엇도 증명되지 않았다** — dev-notes §6이 이를 정직하게 명시하고 있음을 확인했다(§9).

---

## 0. 종료 기준 재실행 결과 (내가 직접 실행)

| 항목 | developer 보고 | qa-logic 실측 | 판정 |
|---|---|---|---|
| `npx tsc --noEmit` | 0 에러 | **0 에러**(exit 0) | ✅ 일치 |
| `npm test` | 195 suites / 1821 tests green | **195 suites / 1821 tests green, exit 0** | ✅ 일치 |
| 재현성 | — | **전체 9회 실행 중 8회 green.** 1회(최초 실행) `OtaUpdateGate.integration.spec.tsx` 3케이스 실패 | ⚠️ [저] I-1 |
| 캐시 초기화 후 | — | `npx jest --clearCache` → **195/1821 green, exit 0** | ✅ |

숫자는 developer 보고와 정확히 일치한다.

---

## 1. 네이티브 미탑재 안전성 (최우선) — ✅ 통과

**위험 근거(재확인)**: `node_modules/expo-updates/build/ExpoUpdates.js:1,5`
```js
import { requireNativeModule } from 'expo-modules-core';
export default requireNativeModule('ExpoUpdates');   // Optional 아님 → 미탑재 시 import 즉시 throw
```
→ `import ... from 'expo-updates'`가 **모듈 그래프 어디에 있든** 현 Dev Client는 부팅 즉시 크래시한다(architecture §5 push S1 전례).

| 검증 | 방법 | 결과 |
|---|---|---|
| 코드베이스 전수 top-level import | `grep -rn "expo-updates" src App.tsx jest.setup.ts plugins scripts` | **값 import 0건.** 유일한 런타임 접촉은 `src/features/ota/updatesModule/updatesModule.ts:44`의 **함수 내부 동적 `require`** |
| `updatesModule.ts` top-level import | 파일 line 9 | `expo-modules-core`의 `requireOptionalNativeModule` **하나뿐** ✅ |
| `typeof import('expo-updates')` (line 44 캐스팅) | TS 타입 전용 — 런타임 로드 유발 없음 | ✅ 무해 |
| probe 성공 이후에만 require | `updatesModule.ts:40` `if (!isUpdatesNativeModuleAvailable()) return null;` → `:44` require | ✅ 코드 경로상 **probe 통과 후에만** 실행 |
| probe 자체가 throw 시 | `:28-32` try/catch → `false` | ✅ 예외 밖으로 안 샘 |
| require가 throw 시 | `:51-54` try/catch → `null`, **로그 0** | ✅ 로그 폭탄 없음 |
| App 진입 경로 | `App.tsx:18 → @/features/ota(index.ts) → ./updatesModule` | 배럴을 타도 top-level에 오는 건 `expo-modules-core`뿐 ✅ |
| probe API 실존 | `node_modules/expo-modules-core/build/requireNativeModule.d.ts:18` `requireOptionalNativeModule<T>(name): T \| null` | ✅ |
| 모듈명 문자열 정합 | 생산자 `ExpoUpdates.js:5` `'ExpoUpdates'` ↔ 소비자 `updatesModule.ts:21` `UPDATES_NATIVE_MODULE_NAME = 'ExpoUpdates'` | ✅ 문자열 일치(추측 아님) |
| 선례 동일성 | `usePushReceive.ts:11,44-45,68` 과 동일 패턴 | ✅ 프로덕션 검증된 패턴 |

**결론: 현 Dev Client / 현재 스토어 설치본에서 이 스프린트로 인한 크래시 경로는 없다.** (⚠️ 단, 자동 테스트는 `expo-modules-core`를 모킹하므로 **실제 probe를 통과하는 테스트는 없다** → §9 L9 제안.)

---

## 2. 두 축 우선순위 계약(§4.2) — ✅ 통과 (4행 전부 코드로 성립)

경로를 양쪽 다 읽어 대조: `App.tsx:88-93` → `AppVersionGate.tsx:41-63` → `OtaUpdateGate.tsx:19-32` → `useOtaUpdate.ts:41-81`.

| §4.2 계약 | 생산자 근거 | 소비자 근거 | 판정 |
|---|---|---|---|
| **force** → 체크·다운로드 0, 안내 0 | `AppVersionGate.tsx:41-48` — force면 `return <ForceUpdateScreen/>`, **children을 렌더조차 안 함** | `App.tsx:88-93` 중첩 순서상 `OtaUpdateGate`가 children → **마운트 0** → `useOtaUpdate`의 effect 미실행 → `loadUpdatesModule` 호출 0 | ✅ |
| **suggest** → 다운로드 O, 안내 X | `AppVersionGate.tsx:53` `<AppVersionGateStatusProvider status={state.status}>` | `OtaUpdateGate.tsx:21,23` `useAppVersionGateStatus() !== 'suggest'` 일 때만 다이얼로그. 훅은 조건 없이 실행 → 다운로드는 진행 | ✅ |
| **checking** → 체크 O, ready면 안내 O | 동상 (`'checking'` 전달) | `:23` 조건이 `!== 'suggest'`뿐이라 checking은 통과(fail-open) | ✅ |
| **none** → 정상 경로 | 동상 | 동상 | ✅ |

**"force면 `checkForUpdateAsync`가 아예 호출되지 않는다"의 검증이 순환인가 — 아니다.**
`OtaUpdateGate.integration.spec.tsx`는 **실 `useOtaUpdate` + 실 `OtaUpdateGate` + 실 `AppVersionGate` + 실 `AppVersionGateStatusProvider` + 실 `shouldCheckOta`** 를 함께 렌더하고, 모킹은 **최하단 경계 2개**(`../updatesModule` = 네이티브 로더, `useAppVersionGate` = Supabase 조회)뿐이다(`:12-13`). 즉 자기 자신을 모킹해 증명하는 구조가 아니다.
- `:58-64` force 케이스가 단언하는 것: `loadUpdatesModule` **호출 0** + `checkForUpdateAsync` **호출 0** + `ota-ready-card` 부재 + `app-body` 부재. 게이트 중첩을 뒤집으면 `loadMock`이 호출되어 **반드시 빨개진다** → load-bearing.
- `:67-72` none 케이스는 check 1회·fetch 1회를 실제 호출로 확인.
- `:74-82` suggest 케이스는 **fetch는 호출되고**(`toHaveBeenCalledTimes(1)`) 다이얼로그만 없음을 단언 — "억제"와 "미실행"을 구별한다. 이 구별이 §4.2의 핵심이며 제대로 잡혀 있다.

**App.tsx 실제 중첩 순서 회귀 가드**: `App.spec.tsx` "T8: AppVersionGate → OtaUpdateGate → AuthGate 순으로 중첩된다" — `within(versionGate).getByTestId('ota-update-gate')` → `within(otaGate).getByTestId('auth-gate')`로 **포함관계**를 단언. 순서를 뒤집으면 실패한다 ✅.
(integration spec은 자체 트리를 만들므로 App.tsx 배선은 검증하지 않는다 — 그 몫을 App.spec.tsx가 정확히 메우고 있어 **두 테스트가 상호 보완적**이다. 공백 없음.)

---

## 3. 비용 가드레일 (절대 규칙) — ✅ 통과

| 항목 | 코드 근거 | 테스트 근거 | 판정 |
|---|---|---|---|
| 폴링 0 | `useOtaUpdate.ts:71-81` effect deps `[]`, 재진입 경로 없음 | `useOtaUpdate.spec.ts:161,170` `setInterval` 미호출 단언 | ✅ |
| 타이머 0 | 전 파일에 `setTimeout`/`setInterval` 0 | 동상 | ✅ |
| AppState 리스너 0 | 전 파일에 `AppState` 참조 0 | `:160,169` `AppState.addEventListener` 미호출 단언 | ✅ |
| 마운트당 check 정확히 1회 | `:36,73-76` `initializedRef` — `if (!initializedRef.current) { initializedRef.current = true; ... }`. **리렌더로 effect가 재실행되지 않고(deps `[]`), 설령 재실행돼도 ref 가드가 2회차를 막는다(2중 방어)** | `:159-171` 리렌더 후 `toHaveBeenCalledTimes(1)` | ✅ |
| StrictMode 재마운트 | `grep -rn StrictMode src App.tsx` → **미사용**. 가정상 double-invoke가 와도 `initializedRef`가 컴포넌트 인스턴스 수명 동안 유지되어 2회차 차단. cleanup이 `mountedRef=false` 후 재실행 시 `:72`가 다시 `true`로 복구해 in-flight 응답도 정상 반영 | — | ✅ |
| 네이티브 자동 체크 꺼짐 | `app.json:13` `"checkAutomatically": "ON_ERROR_RECOVERY"` | `otaConfig.spec.ts:25-27` | ✅ |
| 가드 false → 네트워크 0 | `useOtaUpdate.ts:49` `if (!canCheck \|\| updates === null) return;` — **setState보다 앞** | `useOtaUpdate.spec.ts:48-71` 3케이스(미탑재/개발/비활성) 각각 `checkForUpdateAsync` 미호출 | ✅ |
| force 시 0회 | §2 참조 | `integration.spec.tsx:62-63` | ✅ |
| Supabase·Kakao·AWS 호출 0 | `src/features/ota/**`에 `@/lib/supabase`·kakao 참조 0. 마이그레이션·RLS·Edge Function 변경 0 | — | ✅ |
| 콜드스타트 블로킹 0 | `app.json:14` `fallbackToCacheTimeout: 0` + `OtaUpdateGate.tsx:27` children 무조건 렌더 | `OtaUpdateGate.spec.tsx:47-57` 5상태 전부 children 렌더 | ✅ |

**RLS/보안**: DB 접근 0 · 키 노출 0 · 이미지 처리 0 — 이 기능의 공격 표면은 EAS Update 엔드포인트뿐이며 코드 서명(code signing)은 plan §2에서 의식적으로 후속 처리됨(문서화 확인, architecture §7 (G)).

---

## 4. 회귀 0 — ✅ 통과

| 대상 | 확인 | 판정 |
|---|---|---|
| `AppVersionGate` 렌더 분기 | `AppVersionGate.tsx:41-48`(force) / `:53`(children) / `:54-61`(suggest 모달) — **분기·props·export 불변**, Provider 1겹만 삽입 | ✅ |
| `AppVersionGate.spec.tsx` 무수정 | 파일 내 `Ota`/`GateStatus`/`appVersionGateStatus` 언급 **0건** → 기존 spec 그대로 통과 | ✅ |
| `useAppVersionGate`·`UpdateSuggestModal`·`ProfileScreen` | 이 스프린트 수정 파일 목록에 없음 + 전체 스위트 green | ✅ |
| `src/features/appVersion/index.ts` 배럴 | `:25-30` **추가만**(export 삭제·이름 변경 0). 기존 13개 export 그대로 | ✅ |
| 순환 의존 | `appVersionGateStatus.tsx:8` 이 `useAppVersionGate`를 **`import type`(타입 전용)** 으로만 참조 → 런타임 그래프에 간선 없음. `appVersion → ota` 방향 참조 0 → **사이클 없음** | ✅ |
| `App.spec.tsx` | 기존 2케이스 유지 + T8 1케이스 추가(삭제 0) | ✅ |

---

## 5. 설정 파일 계약 — ✅ 통과 (문자열 직접 대조)

| 항목 | 실측 | 판정 |
|---|---|---|
| `app.json` updates 4필드 | `:11` url · `:12` `enabled:true` · `:13` `ON_ERROR_RECOVERY` · `:14` `fallbackToCacheTimeout:0` | ✅ |
| `runtimeVersion` | `:16-18` `{"policy":"appVersion"}` | ✅ |
| **projectId 문자열 대조** | `app.json:11` `https://u.expo.dev/ddb39563-4389-4043-9d83-06dd84769191` ↔ `app.json:78` `"projectId": "ddb39563-4389-4043-9d83-06dd84769191"` — **완전 일치** | ✅ |
| `version` | `:5` `"1.2.0"` — **bump 없음**(리더 Q1 결정대로) | ✅ |
| plugins | `:42-75` **10개 그대로**(expo-dev-client·expo-font·expo-splash-screen·expo-asset·expo-image-picker·expo-location·expo-notifications·withFmtConstevalFix·withAndroidLaunchMode·expo-apple-authentication). `expo-updates` 수동 추가 없음 — `@expo/prebuild-config`의 `versionedExpoSDKPackages` 자동 적용 사유 문서화됨(`otaConfig.spec.ts:41-42`) | ✅ |
| `ios`/`android`/`scheme`/`icon` | 무변경 | ✅ |
| `eas.json` 채널 3종 | `:10` development · `:16` preview · `:22` production | ✅ |
| `appVersionSource` | `:4` `"remote"` 유지 | ✅ |
| `production.autoIncrement` | `:19` `true` 유지 | ✅ |
| `package.json` | `expo-updates: "~0.27.5"` 1건 추가. `npx expo install --check` → **`Dependencies are up to date`** (deps 33 / devDeps 8, 다른 버전 변동 징후 0) | ✅ |

`otaConfig.spec.ts`가 위 항목을 **파일을 실제로 읽어** 단언한다(껍데기 아님) — 값을 바꾸면 즉시 빨개진다.

---

## 6. 인수조건 ↔ 테스트 1:1 대응 (TDD) — ✅ 통과

| T | 인수조건 | 대응 테스트 | 의미성 판정 |
|---|---|---|---|
| T1 | app.json 5필드+projectId 일치+version 유지+plugins 불변 | `otaConfig.spec.ts:13-50` (7 it) | 실 파일 파싱 단언 ✅ |
| T2 | eas.json 채널 3 + 기존 키 불변 | `otaConfig.spec.ts:53-72` (2 it) | ✅ |
| T3 ①②③④⑤ | probe null→require 미접촉 / require throw→null / 정상 / top-level import 0 / 실제 모듈명 | `updatesModule.spec.ts:41-88` (6 it). `mockRequireTracker.count`로 **require 접촉 횟수를 실제 관측**(`:49` `toBe(0)`, `:67` `toBe(1)`) | 매우 강함 ✅ |
| T4 | 8조합 전수 | `shouldCheckOta.spec.ts` — true 1 + `it.each` false 7 = **8조합 전수** | ✅ |
| T5 ①~⑩ | 10항목 | `useOtaUpdate.spec.ts` AC1(×3)·AC2·AC3·AC4·AC5(×2)·AC6·AC7·AC8·AC9·AC10 = **13 it, 10항목 전부** | AC3은 fetch를 수동 resolve로 붙잡아 **`downloading` 중간 상태를 실제로 관측**(`:83-96`) — 껍데기 아님 ✅ |
| T6 ①②③ | Provider 밖 기본값 / 4상태 전달 / 기존 spec 무수정 | `appVersionGateStatus.spec.tsx` (기본값 1 + `it.each` 4 + 게이트 경유 3 + force 미마운트 1) | force 케이스가 `queryByTestId('gate-status')` **null**을 단언 = 소비자 미마운트를 실증 ✅ |
| T7 (로직 몫) | 콜백 배선·testID·props | `OtaUpdateGate.spec.tsx:89-96` apply/dismiss 각 1회 + `OtaReadyDialog.tsx:48,58,89,100` testID 4종 | dev-notes §2 11행 계약(`ota-ready-card`·`ota-apply`·`ota-dismiss`·`ota-ready-backdrop`)과 **완전 일치** ✅ |
| T8 ①~⑥ | 6항목 | `OtaUpdateGate.spec.tsx`(5상태×children + ready×none/checking/suggest + 4상태 미노출 + 콜백 + Provider 밖) + `.integration.spec.tsx`(force/none/suggest) + `App.spec.tsx`(중첩) | 매트릭스 전수 ✅ |
| T9 | 문서 5항목 | §8 참조 | ✅ |
| T10 | 전체 green + tsc 0 | §0 재실행 | ✅ |

**껍데기 테스트 색출 결과: 발견 0.** 표본 점검한 핵심 단언은 전부 대상 값에 의존한다 —
`updatesModule.spec.ts:49`(require 접촉 0), `useOtaUpdate.spec.ts:168`(check 1회), `integration.spec.tsx:62`(force 시 로더 미호출), `otaConfig.spec.ts:22`(projectId 파생 문자열 비교). 이들은 구현이 계약을 어기면 반드시 실패한다.
(⚠️ 실제 소스 변형(mutation) 실행은 "코드 수정 금지" 지시에 따라 하지 않았고, **정적 대조로 판정**했음을 명시한다.)

---

## 7. 코드 컨벤션 (`docs/code-convention.md`) — ✅ 통과

| 규칙 | 전수 grep 결과 |
|---|---|
| `useCallback`/`useMemo` 지양 | 이 스프린트 신규/수정 파일 **0건**. (전체 코드베이스에 1건 잔존 — `src/navigation/useRefreshOnFocus/useRefreshOnFocus.ts:26` **선행 스프린트 유물, 본 스프린트 범위 밖**) |
| 컴포넌트·훅 화살표 const | `src/features/ota/**`·`appVersionGateStatus/**`·`src/test/setDevMode.ts`에 `export function` **0건** |
| named-object 인자 | `shouldCheckOta({isDev,hasModule,isEnabled})` · `setDevMode({isDev})` · `openStore({storeUrl})` · `AppVersionGateStatusProvider({status,children})` ✅. `applyUpdate()`/`dismiss()`는 무인자, `.catch(error)`는 외부 API 콜백 → 예외 규정 해당 |
| useEffect 명명 함수 | `useOtaUpdate.ts:71` `function checkOtaOnMount()` + `:77` `function cleanupOtaCheck()` / `:87` `function recoverFromReloadFailure(error)`. 신규 파일 인라인 `useEffect(() =>` **0건** |
| enum-style 상수 | `OtaStatus` `as const` + 파생 타입(`useOtaUpdate.ts:13-20`), `UPDATES_NATIVE_MODULE_NAME`(`updatesModule.ts:21`), `DIALOG_LAYOUT as const` |
| 파일명 = 심볼명 | 전 슬라이스 일치. `otaConfig/otaConfig.spec.ts`는 **대표 심볼 없는 spec-only 슬라이스** — 선례 `src/features/appVersion/appConfigMigration/appConfigMigration.spec.ts` **실재 확인** ✅ |
| raw hex | `src/features/ota/**` **0건**(토큰 경유) |

---

## 8. 문서 정합 (실제 구현과 대조) — ✅ 통과

| 문서 위치 | 대조 결과 |
|---|---|
| architecture **§1** (`:23`) | 2축 결정 + `appVersion` 정책 + `nativeVersion`/`fingerprint` 기각 사유 — plan §3.1 표와 일치 ✅ |
| architecture **§5** (`:249`) | `expo-updates@0.27.5`·4필드·채널 3·`ExpoUpdates` probe·5상태·트리 `AppVersionGate → OtaUpdateGate → AuthGate`·두 축 우선순위 — **전부 실제 코드와 일치**. 상태 `✅ 완료(코드) — 라이브 이월 L1~L8` 로 **정직하게 한정** ✅ |
| architecture **§6** (`:268`) | MAU 1,000 / 100 GiB / 20 GiB / $0.10·$0.05 — plan §8 draft 문구 그대로. `assets/` 13 MB·`assetBundlePatterns:"**/*"` 언급이 `app.json:20`과 일치 ✅ |
| architecture **§7 (A)** (`:290-302`) | 판정 기준표 **11행** ↔ plan §4.1 **11행** — 행·축·사유 **한 줄씩 대조 완료, 불일치 0** ✅ |
| architecture **§7 (B)** (`:306-308`) | "네이티브 변경 시 반드시 `version` bump" 규율 + 크래시 메커니즘 설명 + `fingerprint` 이전 조건 ✅ |
| architecture **§7 (C)** (`:310-315`) | 최초 활성화 5단계. **`:311`이 "`version` bump는 스프린트 산출물에 미포함 — app.json은 1.2.0 그대로"를 명시** → 실제 `app.json:5`와 일치. 운영자가 오해할 여지 차단 ✅ |
| architecture **§7 (D)(E)(F)(G)** (`:317-332`) | 배포 순서(마이그레이션 선행)·롤백(서브커맨드 추측 금지)·한 문장 요약·채널 정책 — plan §9-3과 일치 ✅ |
| **CLAUDE.md** (`:40`) | 변경 이력 1행. 버전(0.27.5)·4필드·probe 모듈명·두 축 우선순위·금지 조합·라이브 이월 — **실제 구현과 일치**(과장·누락 없음) ✅ |

**문서↔코드 불일치 0건.** 특히 §7 (C) 1항이 "app.json은 1.2.0 그대로"를 굵게 못박아 둔 점은 운영 사고를 막는 좋은 방어다.

---

## 9. 라이브 이월(L1~L8) 정직성 — ✅ 통과 + 제안 1건

dev-notes §6이 **"아직 아무것도 실증되지 않았다"** 를 제목에 명시하고 L1~L8을 전부 `⏳ 이월`로 표기했다. **단위 테스트로 증명 불가한 것을 "통과"로 위장한 흔적 없음** ✅.
plan §5-1의 L1~L8 ↔ dev-notes §6의 L1~L8 — **8행 전부 대응, 누락 0**.

**[정보] I-4 — L9 추가 제안(라이브 체크리스트 공백)**
현 L5는 "Dev Client에서 OTA **미발화**(`isEnabled` false)"인데, 이는 **앱이 이미 부팅했다는 전제**를 깔고 있다. 이 스프린트의 최대 리스크는 "미발화"가 아니라 **"부팅 자체가 안 되는 것"**(§1의 top-level import 크래시)이며, 자동 테스트는 `expo-modules-core`를 모킹하므로 **실제 `requireOptionalNativeModule` probe를 통과하는 테스트가 하나도 없다**.
→ 권고: dev-notes §6·architecture §5에 **L9 "현 Dev Client(expo-updates 미탑재) 콜드스타트 무크래시 — `npm run ios:sim` 후 Metro 로그에 `ExpoUpdates` 관련 예외 0"** 을 **최우선 항목으로** 추가. (메모리 `native-module-debug-needs-devbuild`: 이 프로젝트는 네이티브 모듈 문제가 preview/production 로그에서 안 보이고 dev build + Metro 로그로만 드러난 전례가 있다.)
※ 정적 분석 + `usePushReceive` 프로덕션 선례상 **위험은 낮다**고 판단하나, "테스트로 커버됐다"고 오해하지 않도록 목록화가 필요하다.

---

## 10. 발견 사항 (전부 [저]/[정보] — 스프린트 차단 없음)

### [저] I-1 — `npm test` 최초 1회 실패(재현 불가, 캐시 아티팩트로 판단)
- **관측**: 전체 9회 실행 중 **최초 1회만** `OtaUpdateGate.integration.spec.tsx` 3케이스가 `ReferenceError: setDevMode is not defined`(`:42`·`:52` beforeEach/afterEach)로 실패. 이후 8회(단독 실행 포함, `jest --clearCache` 직후 포함) 전부 green.
- **경로**: 생산자 `src/test/setDevMode.ts:10`(named export) ↔ 소비자 `OtaUpdateGate.integration.spec.tsx:10`(`import { setDevMode } from '@/test/setDevMode'`) / `useOtaUpdate.spec.ts:8`. **정적으로는 완전 정합**이며, `moduleNameMapper` `^@/(.*)$ → <rootDir>/src/$1`로 해석도 정상.
- **판단**: `ReferenceError`(bare identifier)는 **변환 산출물에 import 구문이 없을 때만** 발생한다 — 즉 babel-jest가 **import 추가 이전(TDD Red 단계) 상태의 캐시된 변환 결과**를 재사용했을 때의 서명과 일치한다. `jest --clearCache` 후 green이 이를 뒷받침한다. **커밋된 코드의 결함이 아니라 개발 머신의 stale transform 캐시 아티팩트**로 판단한다(watchman `MustScanSubDirs UserDropped` 리크롤 경고 33회 동반 관측).
- **권고**: 코드 수정 불필요. CI/다음 세션에서 **`npx jest --clearCache && npm test`** 로 1회만 재확인. 재현되면 그때 원인 재조사.

### [저] I-2 — suggest 모달을 닫으면 OTA 안내가 곧바로 이어서 뜬다(연속 모달)
- **경로**: 생산자 `useAppVersionGate.ts:84-88` `dismissSuggest()` → `setState({status:'none'})` ↔ 소비자 `OtaUpdateGate.tsx:23` `storeGateStatus !== 'suggest'`.
- **시나리오**: 스토어 권유 모달 노출 중 OTA 다운로드 완료(`ready`) → 사용자가 권유 모달의 "나중에" 탭 → 게이트 상태 `suggest → none` → **같은 프레임에 OTA 안내가 등장**. 모달 2개 "동시" 겹침은 없으나 **연속 2회 노출**이 된다.
- **영향**: 낮음(기능 오류 아님, 사용자 혼란 가능성만). plan §4.2는 "겹침 방지"만 규정하고 이 전이는 규정하지 않았다.
- **권고**: 의도된 동작이면 architecture §7에 한 줄 명문화, 아니면 후속에서 `dismiss` 억제 플래그 추가. **테스트 미커버 전이**이므로 어느 쪽이든 케이스 1건 추가를 권함.

### [정보] I-3 — 배럴 무게 문제는 다른 곳에도 잠재 (developer 이탈 결정 ② 검토 결과)
- **결정 ①(spec 2파일 분리): 타당** — 한 파일에서 동일 모듈의 모킹/실물 동시 사용이 불가하고, "force면 check 0"은 실 호출로만 의미가 있다. 껍데기 단언으로 우회하지 않은 판단이 옳다.
- **결정 ②(`@/features/appVersion/appVersionGateStatus` 딥 import): 타당, 위반 아님.**
  - 레이어링: `ota → appVersion` **단방향**. 역방향 참조 0, `appVersionGateStatus.tsx:8`은 `import type`이라 런타임 간선 없음 → **순환 의존 없음** ✅.
  - 관례: 크로스-피처 딥 import는 이 코드베이스의 **확립된 패턴**(전수 grep 60+건 — `ProfileScreen → @/features/appVersion/AppVersionRow`·`currentAppVersion`·`useAppUpdateStatus`, `App.tsx → @/features/notif/usePushReceive` 등). 예외가 아니라 다수파다.
- **잠재 위험(본론)**: `@/features/appVersion` 배럴은 `fetchAppConfig`를 통해 `@/lib/supabase`(→AsyncStorage 네이티브)를 **무조건** 끌어온다(`fetchAppConfig.ts:6`). 즉 **이 배럴을 import하는 모든 신규 소비처·spec은 supabase 모킹을 강제받는다.** 지금은 기존 소비처가 전부 딥 import거나 모킹을 갖춰 문제가 없으나, 구조적 부채는 남아 있다.
- **권고(후속, 이번 스프린트 아님)**: 배럴에서 사이드이펙트 있는 모듈(`fetchAppConfig`)을 분리하거나, "features 배럴은 프리젠테이션·타입만, 무거운 슬라이스는 딥 import"를 `docs/code-convention.md`에 규칙으로 명문화. `notif`·`map` 배럴도 동일 점검 대상.

### [정보] I-4 — L9 라이브 항목 추가 제안
§9 참조.

### (참고) 부수 관찰 — 수정 요청 아님
- `updatesModule.spec.ts:87`의 top-level import 금지 단언은 **`updatesModule.ts` 한 파일에만 적용**된다(다른 파일이 `import 'expo-updates'`를 추가하면 못 잡는다). 또 정규식 `/^\s*import\s[^\n]*from\s+'expo-updates'/m`은 부작용 import(`import 'expo-updates';`)와 여러 줄 import를 놓친다. **현 시점 코드베이스 전수 grep 결과 위반 0건**이므로 실제 노출은 없다. 강화하려면 `src/**` 전수를 스캔하는 단언으로 확장 가능.
- `App.tsx:4` 프로바이더 순서 주석이 `AppVersionGate`/`OtaUpdateGate`를 포함하지 않는다(선행 스프린트부터의 누락). 게이트 자체는 `:87`·`:89` 인라인 주석으로 설명돼 있어 실질 혼선은 없다.

---

## 11. 엣지케이스(plan §6) 대조

| 엣지케이스 | 코드 근거 | 테스트 |
|---|---|---|
| 오프라인 콜드스타트 | `useOtaUpdate.ts:65-68` catch → idle, UI 0 | AC5 ✅ |
| 다운로드 중 끊김 | 동상(같은 catch) | AC5 ✅ |
| 다운로드 중 앱 종료 | `mountedRef`(`:55,63`)로 setState 차단, 네이티브가 다운로드 관리 | AC10 ✅ |
| "나중에" 후 재노출 없음 | `dismiss()`→idle(`:94`), `initializedRef`로 재체크 0 → ready 재진입 경로 없음 | AC8+AC9 ✅ |
| 같은 세션 반복 안내 방지 | deps `[]` + `initializedRef` | AC9 ✅ |
| force 동시 발화 | §2 | integration ✅ |
| suggest 동시 발화 | §2 | integration + unit ✅ |
| 작성 중 안내 → 입력 유실 | 자동 reload 없음(사용자 탭만, `:83-92`) + 다이얼로그 본문이 저장 권고(`OtaReadyDialog.tsx:80-82`) | ✅ (T7 ⑥ 충족) |
| `reloadAsync` 실패 | `:87-91` idle 복귀 + `console.warn` | AC7(warn 호출 단언 포함) ✅ |
| Dev Client / Expo Go / 테스트 환경 | §1 | T3 ✅ |
| `__DEV__` | `shouldCheckOta` 1차 가드 | AC1 ✅ |
| runtimeVersion 불일치 | 서버 매칭 — 코드 무관 | **L6 이월**(단위 불가) |
| 커플 동시성 | 로컬 판정, 공유 데이터 0 | 해당 없음 ✅ |
| OTA↔마이그레이션 순서 | architecture §7 (D) 2 | 문서 ✅ |
| RLS | DB 접근 0 | 해당 없음 ✅ |

---

## 12. 미검증(사유 명시 — 통과로 처리하지 않음)

| 항목 | 사유 |
|---|---|
| L1~L8 전부 | 원격 인프라(EAS)·네이티브 런타임 의존. **dev-notes §6에 정직하게 목록화됨** |
| L9(제안) — 현 Dev Client 콜드스타트 무크래시 | 자동 테스트는 `expo-modules-core` 모킹 → 실제 probe 미실행. 정적 분석 + `usePushReceive` 선례로 **위험 낮음**이나 실증 필요 |
| `Updates.isEnabled` 실측값 | 네이티브 빌드 구성 의존(L1·L5) |
| `eas update` 실제 발행·수신 | 인프라(L3·L4) |
| 소스 변형(mutation) 기반 테스트 강도 검증 | **"코드 수정 금지"** 지시 준수 — 정적 대조로 대체 판정(§6) |

---

## 13. 결론

- **통합 정합성**: 경계면 11행(dev-notes §2) 전부 생산자↔소비자 양쪽 확인, **불일치 0**.
- **네이티브 안전성**: top-level import 0, probe 후 lazy require, 예외·로그 0 — **현 Dev Client 크래시 경로 없음**.
- **두 축 우선순위**: §4.2 표 4행이 코드로 성립하고, 실물 통합 테스트가 **순환 없이** 이를 증명.
- **비용 가드레일**: 폴링·타이머·AppState 0, 마운트당 check 1회(2중 가드), force 시 0회, 네이티브 자동 체크 off.
- **회귀**: 기존 spec 무수정 통과, 배럴 additive, 순환 의존 없음.
- **테스트**: 195 suites / 1821 tests green(내가 9회 재실행, cold cache 포함) · `tsc --noEmit` 0. 껍데기 테스트 0.
- **문서**: architecture §1·§5·§6·§7 + CLAUDE.md가 **실제 구현과 일치**.

### 종료 판정: ✅ **통과**
후속 권고 4건([저] I-1 캐시 재확인 · [저] I-2 연속 모달 전이 명문화/테스트 · [정보] I-3 배럴 부채 · [정보] I-4 L9 추가)은 **차단 사항이 아니며**, I-4만 릴리스 전 라이브 체크리스트에 반영할 것을 권한다.
