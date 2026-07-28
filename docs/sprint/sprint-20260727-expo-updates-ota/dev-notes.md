# dev-notes — expo-updates OTA (developer)

> 대상: `plan.md` T1~T6, T8~T10 (T7 `OtaReadyDialog`는 ui-publisher 소관 — `ui-spec.md`).
> 종료 기준 결과: **`npm test` 195 suites / 1821 tests 전부 green** · **`npx tsc --noEmit` 0 에러**.
> git 작업 0(파일 편집만). DB 변경 0(마이그레이션·RLS·Edge Function 0). Supabase·Kakao 호출 0.

---

## 1. 설치된 패키지 · 호환성 확인

| 항목 | 값 | 근거 |
|---|---|---|
| 설치 명령 | `npx expo install expo-updates` | SDK 52 호환 버전 자동 선택 |
| package.json | `"expo-updates": "~0.27.5"` | dependencies |
| 실제 설치 버전 | **0.27.5** | `node_modules/expo-updates/package.json` |
| 의존성 정합 | **`npx expo install --check` → `Dependencies are up to date`** | 과거 `expo-file-system` 누락 전례 대비 확인. 다른 패키지 버전 변동 0 |
| app.json `plugins` | **무변경(10개 그대로)** | `expo-updates`는 `@expo/prebuild-config`의 `versionedExpoSDKPackages`에 포함(`node_modules/@expo/prebuild-config/build/plugins/withDefaultPlugins.js:187`) → 설치만으로 prebuild가 자동 적용. 수동 plugins 항목 추가 불필요 |

### 네이티브 모듈명 grep 근거 (추측 아님 — plan §3.3 ⑤)

```
node_modules/expo-updates/build/ExpoUpdates.js:1  import { requireNativeModule } from 'expo-modules-core';
node_modules/expo-updates/build/ExpoUpdates.js:5  export default requireNativeModule('ExpoUpdates');
```

→ 네이티브 모듈명 = **`'ExpoUpdates'`**. `updatesModule.ts`의 `UPDATES_NATIVE_MODULE_NAME` 상수가 이 문자열이다.

**⚠️ 이 파일이 `requireNativeModule`(Optional 아님)을 top-level에서 실행한다** = 네이티브 미탑재 시 **import 즉시 throw**. 그래서 `import ... from 'expo-updates'`가 코드베이스 어디에도 없어야 하고(전수 grep 0건), 반드시 `requireOptionalNativeModule('ExpoUpdates')` probe를 통과한 뒤에만 함수 내부에서 `require`한다. 소스에 top-level import가 없음을 **테스트로도 강제**한다(`updatesModule.spec.ts` 마지막 케이스, 파일 소스 정규식 단언).

또한 우리가 쓰는 4개 표면이 설치 버전에 실재함을 확인: `node_modules/expo-updates/build/Updates.d.ts:11`(`isEnabled`)·`:109`(`reloadAsync`)·`:125`(`checkForUpdateAsync`)·`:176`(`fetchUpdateAsync`).

---

## 2. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| # | 생산자 | 계약(shape) | 소비자 |
|---|---|---|---|
| 1 | `app.json > expo.updates.url` | `https://u.expo.dev/{projectId}` | EAS Update 서버 ↔ `extra.eas.projectId`(`ddb39563-…`)와 **동일 id**. `otaConfig.spec.ts`가 두 값의 일치를 단언 |
| 2 | `app.json > runtimeVersion.policy = "appVersion"` | 해석값 = `expo.version` = `1.2.0` | EAS 빌드/발행 매칭. **스토어 게이트가 쓰는 `version`과 같은 문자열이지만 서로를 읽지 않는다**(게이트는 `app_config.min/latest_version` ↔ `getCurrentAppVersion()`) → 코드 변경 0 |
| 3 | `eas.json > build.*.channel` | `development`/`preview`/`production` | `eas update --channel <x>` 도달 대상 |
| 4 | `expo-updates` 네이티브(`ExpoUpdates`) | — | **`loadUpdatesModule()`** → `UpdatesModule \| null` |
| 5 | **`loadUpdatesModule()`** (`src/features/ota/updatesModule/`) | `{ isEnabled: boolean; checkForUpdateAsync: () => Promise<{isAvailable:boolean}>; fetchUpdateAsync: () => Promise<{isNew:boolean}>; reloadAsync: () => Promise<void> } \| null` | `useOtaUpdate` |
| 6 | **`shouldCheckOta()`** (`src/features/ota/shouldCheckOta/`) | `({isDev, hasModule, isEnabled}) => boolean` | `useOtaUpdate` (가드 false면 **네트워크 호출 0**) |
| 7 | **`useOtaUpdate()`** (`src/features/ota/useOtaUpdate/`) | `{ state: {status: OtaStatus}, applyUpdate: () => void, dismiss: () => void }`, `OtaStatus = idle\|checking\|downloading\|ready\|reloading` | `OtaUpdateGate` |
| 8 | **`useAppVersionGate().state.status`** (기존) | `'checking'\|'force'\|'suggest'\|'none'` | `AppVersionGate` → **`AppVersionGateStatusProvider`** |
| 9 | **`AppVersionGateStatusProvider`** (`src/features/appVersion/appVersionGateStatus/`) | 컨텍스트 값 = 위 status. **Provider 밖 기본값 `'none'`** | **`useAppVersionGateStatus()`** → `OtaUpdateGate`(suggest 억제 판정) |
| 10 | **`OtaUpdateGate`** (`src/features/ota/OtaUpdateGate/`) | `children` 항상 렌더 + `status==='ready' && storeGateStatus!=='suggest'`일 때만 다이얼로그 | `App.tsx` |
| 11 | **`OtaReadyDialog`** (ui-publisher, T7) | `{ visible: boolean; onApply: () => void; onDismiss: () => void }`, testID `ota-ready-card`·`ota-apply`·`ota-dismiss`·`ota-ready-backdrop` | `OtaUpdateGate`가 `onApply={applyUpdate}` / `onDismiss={dismiss}`로 배선 |

**App 트리(최종)**: `GestureHandlerRootView → SafeAreaProvider → ThemeProvider → ToastProvider → AuthProvider → AppVersionGate → OtaUpdateGate → AuthGate`.
순서가 뒤집히면 force 우선순위가 깨진다(`App.spec.tsx` T8 케이스 + `OtaUpdateGate.integration.spec.tsx`가 회귀 가드).

---

## 3. 신규 · 수정 파일

**신규 — `src/features/ota/`**
- `updatesModule/updatesModule.ts` + `.spec.ts` + `index.ts` (T3)
- `shouldCheckOta/shouldCheckOta.ts` + `.spec.ts` + `index.ts` (T4)
- `useOtaUpdate/useOtaUpdate.ts` + `.spec.ts` + `index.ts` (T5)
- `OtaUpdateGate/OtaUpdateGate.tsx` + `.spec.tsx` + **`.integration.spec.tsx`** + `index.ts` (T8)
- `otaConfig/otaConfig.spec.ts` (T1·T2 설정 계약 스모크 — 대표 심볼 없는 spec-only 슬라이스, `appConfigMigration` 선례)
- `index.ts` (배럴 — `OtaReadyDialog`는 ui-publisher 산출물을 re-export)
- `OtaReadyDialog/*` — **ui-publisher 산출물**(developer 미수정)

**신규 — `src/features/appVersion/`**
- `appVersionGateStatus/appVersionGateStatus.tsx` + `.spec.tsx` + `index.ts` (T6)

**신규 — 테스트 유틸**
- `src/test/setDevMode.ts` — RN 전역 `__DEV__`를 케이스별로 제어. `__DEV__`는 런타임 주입 전역이라 TS `globalThis` 타입에 없어 2단 캐스팅이 불가피한데, 이를 한 곳에 격리하고 `declare global`로 **앱 타입 표면을 넓히지 않기** 위해 테스트 전용 헬퍼로 뒀다(리더 피드백 반영).

**수정**
- `package.json` — `expo-updates ~0.27.5` 추가(+ lock 갱신)
- `app.json` — `updates` 블록 4필드 + `runtimeVersion` 추가. **`version`은 `1.2.0` 그대로**(리더 Q1 결정: bump는 릴리스 행위)
- `eas.json` — 3 프로필에 `channel` 추가(기존 키 무변경)
- `App.tsx` — `OtaUpdateGate` 1겹 추가
- `App.spec.tsx` — 중첩 순서 회귀 케이스 1건 추가
- `src/features/appVersion/AppVersionGate/AppVersionGate.tsx` — children을 Provider로 감싸는 1겹(렌더 분기·props·export 불변)
- `src/features/appVersion/index.ts` — 컨텍스트 export 추가(병합)
- `docs/design/architecture.md` §1·§5·§6·§7 / `CLAUDE.md` 변경 이력 1행

**회귀 0 확인**: 기존 `AppVersionGate.spec.tsx`는 **무수정 통과**(T6 인수조건 ③). `useAppVersionGate`·`UpdateSuggestModal`·`ProfileScreen` 무변경.

---

## 4. plan 대비 벗어난 결정 (전부 사유 포함)

1. **`OtaUpdateGate` spec을 2개로 분리** — `OtaUpdateGate.spec.tsx`(훅 모킹, 5상태×스토어상태 렌더 매트릭스) + `OtaUpdateGate.integration.spec.tsx`(실 `useOtaUpdate` + 실 `AppVersionGate`, 최하단 경계만 모킹). 이유: 한 파일에서 같은 모듈을 모킹/실물 동시 사용이 불가한데, "force면 `checkForUpdateAsync` 호출 0"은 **실제 호출로 확인해야 의미 있는 계약**(§4.2)이라 껍데기 단언으로 대체하지 않았다.
2. **`OtaUpdateGate`가 `@/features/appVersion` 배럴이 아니라 `@/features/appVersion/appVersionGateStatus` 슬라이스를 직접 import** — 배럴은 `fetchAppConfig → @/lib/supabase → AsyncStorage(네이티브)`까지 끌어와 OTA 게이트 렌더에 불필요한 무게·테스트 실패를 유발했다. `App.tsx`의 `@/features/notif/usePushReceive` 딥 import 선례와 동일. 배럴 export 자체는 정상 추가돼 외부 소비는 `@/features/appVersion`로도 가능하다.
3. **jest 전역 setup 무오염** — `jest.setup.ts` 변경 0. `expo-updates`는 테스트에서 각 spec의 `jest.mock`으로만 다룬다. 모킹 없는 spec에서는 `requireOptionalNativeModule('ExpoUpdates')`가 null을 반환해 `loadUpdatesModule()`이 항상 null → 전 스위트에서 expo-updates 실모듈이 로드되지 않는다.
4. **`app.json` `version` bump 미수행** — 리더 Q1 결정대로 `1.2.0` 유지. 최초 활성화 방침(`1.3.0` 릴리스에 태움)은 architecture §7 (C) 1항에 기록했다.

**리더 확정 사항 반영 위치**: Q1 → architecture §7 (C) 1 / Q2(포그라운드 재확인 후속) → §7 (G) / Q3(preview 발행 보류) → §7 (G) / Q4(`fingerprint` 후속 + version bump 규율) → §7 (B) 굵게.

---

## 5. 비용 가드레일 실측 (테스트로 강제)

| 항목 | 값 | 강제 위치 |
|---|---|---|
| 폴링 | **0** | `useOtaUpdate.spec.ts` AC9 — `setInterval` 미호출 단언 |
| AppState 리스너 | **0** | 동 AC9 — `AppState.addEventListener` 미호출 단언 |
| 타이머 | **0** | 동 AC9 |
| 콜드스타트당 `checkForUpdateAsync` | **정확히 1회**(리렌더해도 1회) | 동 AC9 (`initializedRef` + deps `[]`) |
| force 시 확인 | **0회**(게이트 미마운트 → 로더 호출조차 0) | `OtaUpdateGate.integration.spec.tsx` 1번 케이스 |
| 개발/미탑재/비활성 시 네트워크 | **0** | `useOtaUpdate.spec.ts` AC1 ×3 |
| 네이티브 자동 체크 | **꺼짐**(`checkAutomatically: ON_ERROR_RECOVERY`) | `otaConfig.spec.ts` |
| Supabase·Kakao·AWS 호출 | **0** | 이 기능은 DB·외부 API를 전혀 안 씀 |

---

## 6. 라이브/디바이스 검증 이월 목록 (L1~L8) — **아직 아무것도 실증되지 않았다**

> 이 스프린트 산출물은 **`expo-updates`를 포함한 새 네이티브 빌드가 배포된 뒤부터** 유효하다. 현재 설치된 앱·현재 Dev Client에서는 코드가 no-op로 빠진다(설계된 동작).

| ID | 검증 대상 | 방법 | 상태 |
|----|-----------|------|------|
| **L1** | 네이티브 모듈명 `ExpoUpdates` 실동작 · `Updates.isEnabled` **실측값** | 스토어/preview 빌드 실행 후 로그 | ⏳ 이월 (모듈명 자체는 소스 grep으로 확정 — §1) |
| **L2** | EAS 빌드 로그 `Resolved runtime version` = `app.json`의 `version` (appVersionSource `remote`와 무충돌 확증) | `eas build --profile production` 로그 | ⏳ 이월 |
| **L3** | 빌드 산출물 채널 = 프로필 채널, `eas update --channel production` 수신 | EAS 대시보드 + 실기기 | ⏳ 이월 |
| **L4** | **실제 OTA 수신 → 다운로드 → 안내 → reload로 새 번들 반영**(핵심 해피패스) | 같은 runtimeVersion 빌드에 `eas update` 발행 후 실기기 | ⏳ 이월 |
| **L5** | Dev Client(Debug) 빌드에서 OTA **미발화**(`isEnabled` false) | `npm run ios:sim` 후 로그 | ⏳ 이월 |
| **L6** | **다른 runtimeVersion에 발행한 업데이트가 도달하지 않음**(런타임 격리 — 가장 중요) | 1.3.0 발행 후 1.2.0 기기 확인 | ⏳ 이월 |
| **L7** | EAS Update 사용량(MAU 1,000 / 대역폭 100 GiB) | expo.dev 대시보드 | ⏳ 이월 |
| **L8** | force 화면이 떠 있을 때 OTA 안내 0 · 확인 0 | `app_config.min_supported_version` 임시 상향 + 실기기 | ⏳ 이월 (단위로는 integration spec이 커버) |
| **L9** | **현 Dev Client·기존 설치 앱에서 콜드스타트 무크래시**(= `expo-updates` 미탑재 상태에서 우리 코드가 조용히 no-op) | `npm run ios:sim`(또는 기존 Dev Client) 실행 → 앱이 정상 부팅하고 Metro 로그에 expo-updates 관련 예외·경고 0인지 확인 | ⏳ 이월 — **자동 테스트로 커버되지 않음** |

**⚠️ L9를 별도 항목으로 세운 이유(정직한 근거 표기)**: 모든 자동 테스트는 `expo-modules-core`를 `jest.mock`으로 대체한다 → **실제 네이티브 probe를 통과하는 테스트가 하나도 없다.** 즉 "미탑재 환경에서 안전하다"는 **테스트가 아니라 정적 근거**에 기대고 있다:
- `requireOptionalNativeModule`은 모듈 부재 시 throw·로그 없이 `null`을 반환하는 API다(`usePushReceive`가 같은 방식으로 라이브에서 검증된 선례).
- `expo-updates` 값 import가 코드베이스에 0건(전수 grep + `updatesModule.spec.ts` 소스 단언) → 미탑재 시 throw하는 `requireNativeModule('ExpoUpdates')` 경로에 **도달하지 않는다**.
- 추가로 `isUpdatesNativeModuleAvailable`이 probe 자체를 `try/catch`로 감싸고, `loadUpdatesModule`이 require 실패도 흡수한다(2중).

위험은 낮지만 **"테스트로 커버됐다"고 읽히면 안 된다.** 여기서 깨지면 OTA 이전에 **앱 전체가 부팅 불가**가 되므로 라이브 배치의 **첫 항목**으로 둔다.

**추가 주의(라이브 배치에 반드시 포함)**: `expo-updates`는 네이티브 모듈이므로 **Dev Client 재빌드 전에는 `loadUpdatesModule()`이 null**이다. 즉 "OTA가 안 뜬다"가 정상이며, 재빌드 없이 동작을 기대하지 말 것. 이 프로젝트는 네이티브 모듈 문제가 preview/production 로그에서 안 보이고 **dev build + Metro 로그로만 드러난** 전례가 있다.
