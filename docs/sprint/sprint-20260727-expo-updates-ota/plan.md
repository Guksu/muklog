# Sprint: expo-updates OTA (expo-updates-ota)

> 단일 출처: `docs/design/architecture.md`(§1 결정·§5 백로그·§6 비용 가드레일·§7 운영 절차 line 282) · `docs/code-convention.md` · `docs/testing-strategy.md` · 선행 스프린트 `docs/sprint/sprint-20260702-app-version-gate/`·`docs/sprint/sprint-20260722-app-update-actions/` · 현재 코드(`App.tsx`·`AppVersionGate`·`useAppVersionGate`·`usePushReceive`(네이티브 lazy require 선례)·`UpdateSuggestModal`·`eas.json`·`app.json`).
> 파이프라인: **planner → (ui-publisher ∥) developer → qa(qa-visual ∥ qa-logic)**. UI 표면 최소(신설 다이얼로그 1개).
> git 작업 없음. TDD(인수조건 = 테스트 케이스, Red 먼저). 종료 기준 `npm test` 전체 green + `npx tsc --noEmit` 0. 비용 가드레일 최우선(AWS 0 · 폴링 0 · 콜드스타트 1회).

---

## ⚠️ 0. 이 스프린트를 읽기 전에 — 발효 조건 2개 (반드시 먼저)

1. **이 스프린트의 결과물은 "다음 네이티브 빌드부터" 유효하다.** `expo-updates`는 네이티브 모듈이다. 설치·`app.json` 설정만으로는 **현재 설치돼 있는 앱·현재 Dev Client에서 아무 일도 일어나지 않는다**(코드는 no-op로 안전하게 빠진다 — §3.3). 실제 OTA는 `expo-updates`가 포함된 **새 스토어 빌드**가 배포된 뒤부터 동작한다.
2. **첫 OTA 배포 전, 같은 `runtimeVersion`의 스토어 빌드가 이미 배포돼 있어야 한다.** 업데이트는 `runtimeVersion`이 정확히 일치하는 바이너리에만 도달한다. `runtimeVersion = 1.2.0`(§3.1)로 발행한 업데이트는 **`expo-updates`가 들어간 1.2.0 빌드가 스토어에 올라가 있어야만** 사용자에게 닿는다. 현재 스토어의 1.2.0 빌드에는 `expo-updates`가 없으므로 **버전을 올려 재빌드·재심사하는 편이 안전하다**(§9 운영 절차 참고 — 리더 확인 필요, §10 Q1).

---

## 1. 기능 한줄 정의

앱이 콜드스타트 시 EAS Update 서버를 **1회** 확인해, 같은 `runtimeVersion`용 새 JS 번들이 있으면 **백그라운드로 내려받고**, 다운로드가 끝나면 "새 버전이 준비됐어요" 안내를 띄워 **사용자가 탭할 때만 즉시 새로고침(`reloadAsync`)** 한다. 사용자가 무시해도 다음 앱 실행 때 자동으로 적용된다. 스토어 심사 없이 JS 수정사항을 배포할 수 있게 된다.

---

## 2. 범위

### In-scope
- **(a) 인프라** — `expo-updates` 설치 + `app.json`의 `updates` 블록·`runtimeVersion` 정책 + `eas.json` 빌드 프로필 `channel`.
- **(b) 안전 로더** — `updatesModule`(네이티브 미탑재 시 no-op, 함수 내부 `require` + try/catch — 이 프로젝트의 확립된 규칙, §3.3).
- **(c) 순수 판정 유틸** — `shouldCheckOta`(개발/미탑재/비활성 시 발화 금지).
- **(d) 상태 훅** — `useOtaUpdate`(콜드스타트 1회 check → fetch → ready 상태머신, 모킹 테스트).
- **(e) 안내 UI + 배선** — `OtaReadyDialog`(신설, `UpdateSuggestModal` 셸 재사용) + `OtaUpdateGate` 래퍼 + `App.tsx` 배선.
- **(f) 두 업데이트 축의 역할 분리·우선순위 규칙**(§4) — 판정 기준표 + 동시 발화 시 동작. `appVersionGateStatus` 컨텍스트 신설(additive).
- **(g) 문서** — `docs/design/architecture.md` §1 결정 행 · §5 백로그 행 · §6 비용 가드레일 · §7 OTA 운영 절차(배포 순서·롤백·판정 기준표).

### Out-of-scope (일부러 안 함 — 근거 포함)
- **포그라운드 복귀 시 재확인** — v1은 **콜드스타트 1회만**. 근거: ① 선행 `app-version-gate`가 이미 "콜드스타트 1회" 축을 확립했고 두 축을 대칭으로 두면 운영·QA가 단순해진다 ② AppState 리스너는 "fetch 진행 중 백그라운드 전환", "장수명 세션에서 반복 안내 억제", "쿨다운 상태 보존"이라는 새 엣지케이스 3종을 끌고 온다 ③ 모바일 앱은 실무상 하루에도 여러 번 콜드스타트되어 지연 이득이 작다. → **후속 1순위**로 §10에 기록.
- **스플래시를 붙잡는 blocking 적용**(`fallbackToCacheTimeout > 0`) — 콜드스타트 지연이 오프라인/저속망에서 그대로 체감된다. `fallbackToCacheTimeout: 0` 고정.
- **자동 즉시 `reloadAsync`** — 사용자가 먹로그 작성 중(`MuklogEditor` 입력·사진 선택)에 화면이 튀면 입력이 유실된다. 반드시 사용자 탭.
- **`useUpdates()` 훅(expo-updates 제공) 전면 도입** — **기각.** 근거: `useUpdates()`는 `expo-updates`를 **top-level import** 해야 하는데 이 프로젝트는 네이티브 모듈 top-level import로 크래시 전례가 있다(메모리 `native-module-lazy-require`, push S1 핫픽스). 또 내부 이벤트 구독으로 우리가 안 쓰는 상태(`downloadedUpdate`·`checkError`·`isChecking` 등)까지 표면을 넓힌다. 우리는 lazy require + 자체 3상태 머신으로 간다.
- 자동 롤백 자동화 · A/B 롤아웃 · 채널별 스테이징 파이프라인 · CI 자동 `eas update` · OTA 실패 원격 리포팅 · 업데이트 파일 무결성 서명(code signing) — 전부 후속.
- `min_supported_version`/`latest_version`·`app_config` 변경 — 스토어 게이트 축은 **손대지 않는다**(회귀 리스크 0). 이 스프린트는 `AppVersionGate`에 컨텍스트 Provider 1겹만 추가한다(§3.7).

---

## 3. 데이터 · API 계약

> DB 변경 **없음**(마이그레이션 0 · RLS 0 · Edge Function 0). 이 기능은 클라 + 빌드 설정 + Expo 인프라만 쓴다.

### 3.1 `runtimeVersion` 정책 — **확정: `{"policy": "appVersion"}`**

**결론:** `app.json`에 `"runtimeVersion": { "policy": "appVersion" }` → 해석된 runtimeVersion = **`1.2.0`**(app.json `version` 그대로).

**로컬에서 확인한 근거**(추측 아님):

| 근거 | 파일 | 내용 |
|------|------|------|
| `appVersion` 정책은 app config의 `version`을 그대로 쓴다 | `node_modules/@expo/config-plugins/build/utils/Updates.js:147-148` → `getAppVersion` (`:96-98`) | `resolveRuntimeVersionPolicyAsync('appVersion')` → `config.version ?? '1.0.0'` |
| 현재 해석되는 `version` 값 | `npx expo config --type public` 실행 결과 | `version: '1.2.0'` |
| `nativeVersion` 정책은 이 프로젝트에서 **깨진다** | `Updates.js:99-112` + `node_modules/@expo/config-plugins/build/ios/Version.js:36-38` | `nativeVersion` = `` `${version}(${buildNumber})` ``인데 `getBuildNumber(config)`는 `ios.buildNumber` 부재 시 **하드코딩 `'1'`** 반환. `eas.json`의 `appVersionSource: "remote"` 때문에 빌드번호는 app.json에 없고 EAS 서버가 관리·자동증가(`production.autoIncrement: true`) → 정책은 항상 `1.2.0(1)`로 굳어 실제 바이너리 `CFBundleVersion`과 무관해진다. "빌드마다 런타임을 구분한다"는 정책 목적 자체가 무너짐 → **기각** |
| `fingerprint`는 빌드 타임에만 해석된다 | `Updates.js:140`(sentinel `file:fingerprint`) + `:157` 주석 `fingerprint is resolvable only at build time (not in config plugin)` | 로컬 config 단계에서 값이 나오지 않음 |
| `sdkVersion` | `Updates.js:150-155` | SDK가 같으면 네이티브가 달라도 같은 런타임 → 너무 넓다. **기각** |

**`fingerprint`를 v1에서 안 쓰는 이유**(정확도는 더 높지만):
1. **커스텀 네이티브 패치 2종**(`plugins/withFmtConstevalFix.js`가 `node_modules` 내 fmt 헤더를 직접 패치, `plugins/withAndroidLaunchMode.js`)이 fingerprint 해시에 어떻게 반영되는지 **로컬에서 확인 불가** — 잘못 반영되면 매 빌드 런타임이 흔들려 OTA가 아무에게도 안 닿거나, 반대로 네이티브 변경을 놓친다.
2. **`npm run ios:sim`(xcodebuild 직접 호출)** 경로에서 `file:fingerprint` sentinel이 해석되는지 검증할 수단이 로컬에 없다(이 프로젝트는 `expo run:ios`를 우회한다 — CLAUDE.md 변경 이력 2026-06-14).
3. **사람이 못 읽는 해시**라 "지금 스토어에 있는 빌드의 런타임이 뭐냐"를 운영자가 대시보드 없이 알 수 없다. 반면 `appVersion`은 `1.2.0`이라 **스토어 게이트 축(app.json `version`)과 문자열이 같다** — 운영 규칙이 한 문장으로 줄어든다.

**`appVersion` 정책의 유일한 위험과 방어:**
- 위험: **`version`을 안 올리고 네이티브만 바꾼 빌드**가 존재하면, 그 빌드와 이전 빌드가 같은 런타임(`1.2.0`)을 공유해 **비호환 바이너리에 OTA가 도달**한다(네이티브 함수 없는데 JS가 호출 → 크래시).
- 방어(운영 규칙, architecture §7에 명문화 — T9): **네이티브 표면이 바뀌면 반드시 `app.json` `version`을 올린다.** 이 프로젝트는 스토어 제출 시 이미 `version`을 올리고 있고(1.2.0), 스토어 게이트도 같은 값을 쓰므로 **추가 규율이 아니라 기존 규율의 재확인**이다. 판정 기준표는 §4.1.

**`appVersionSource: "remote"`와의 상호작용:**
- `eas.json`의 `appVersionSource: "remote"`는 **빌드번호(`ios.buildNumber`/`android.versionCode`)** 를 EAS 서버가 보관·자동증가하게 하는 설정이다. `version`(마케팅 버전)은 여전히 app.json이 원천이며, 위 표대로 config-plugin은 `config.version`을 그대로 읽는다 → **`appVersion` 정책과 충돌 없음**(로컬 근거 확보).
- ⚠️ **라이브 검증 이월(L2)**: EAS 빌드 로그의 `Resolved runtime version` 값이 실제로 `1.2.0`인지 첫 빌드에서 눈으로 확인한다. 이 프로젝트는 "라이브에서만 드러나는 비호환" 전례가 많다(메모리 `native-module-debug-needs-devbuild`).
- **스토어 게이트와의 충돌 없음**: 스토어 게이트는 `app_config.min/latest_version` ↔ `getCurrentAppVersion()`(=`Constants.expoConfig.version`) 비교다. `runtimeVersion`은 별도 필드이고 값만 같을 뿐 서로를 읽지 않는다. 코드 변경 0.

### 3.2 `app.json` — `updates` 블록 (신규)

```jsonc
// app.json > expo (기존 키 유지, 아래 2개 추가)
"updates": {
  "url": "https://u.expo.dev/ddb39563-4389-4043-9d83-06dd84769191",  // extra.eas.projectId와 동일 id
  "enabled": true,
  "checkAutomatically": "ON_ERROR_RECOVERY",   // 네이티브 자동 체크 끔 — 체크 시점은 JS가 소유(§4.3)
  "fallbackToCacheTimeout": 0                  // 콜드스타트가 네트워크를 절대 기다리지 않음
},
"runtimeVersion": { "policy": "appVersion" }
```

- **`checkAutomatically: "ON_ERROR_RECOVERY"` 근거**: 기본값 `ON_LOAD`면 네이티브 런타임이 실행 때마다 자체적으로 체크한다 → 우리 JS 상태머신과 **이중 체크**가 되고, 테스트로 관찰·억제할 수 없는 네트워크 호출이 생긴다(비용 가드레일 위반). `ON_ERROR_RECOVERY`는 "직전 실행이 크래시했을 때만" 네이티브가 체크 → 평시엔 **JS가 유일한 체크 주체**이고, 크래시 루프 시엔 자동 복구 여지를 남긴다. (`node_modules/@expo/config-plugins/build/utils/Updates.js:181-192`에 4개 값이 그대로 존재함을 확인.)
- **`fallbackToCacheTimeout: 0` 근거**: 기본값도 0(`Updates.js:178`)이나 **명시**한다 — 이 값이 0보다 크면 콜드스타트가 네트워크를 기다려 오프라인에서 앱이 늦게 뜬다.
- **이미 다운로드된 업데이트는 다음 콜드스타트에 자동 적용된다**(expo-updates 런타임이 가장 최신 다운로드분으로 실행). 즉 사용자가 안내를 무시해도 손실이 없다 — §4.3 UX 설계의 전제.

### 3.3 안전 로더 `updatesModule` (신규 — `usePushReceive` 선례 그대로)

```ts
// src/features/ota/updatesModule/updatesModule.ts
/** 이 기능이 실제로 쓰는 expo-updates 표면만 좁게 선언(테스트 모킹 대상 = 이 4개). */
export type UpdatesModule = {
  isEnabled: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
};

/**
 * 현재 빌드에 expo-updates 네이티브 모듈이 탑재됐을 때만 JS 모듈을 로드한다.
 *   미탑재(현 Dev Client·테스트 환경·Expo Go) → null. throw 0, 로그 0.
 */
export const loadUpdatesModule = (): UpdatesModule | null;
```

- 구현 패턴은 **`src/features/notif/usePushReceive/usePushReceive.ts:38-70`과 동일**: `requireOptionalNativeModule(<네이티브 모듈명>)`으로 **조용히 probe**(없으면 null 반환, throw·로그 없음) → 있을 때만 함수 내부에서 `require('expo-updates')` (try/catch) → 실패 시 `null`.
- ⚠️ **네이티브 모듈 이름은 추측 금지.** T1에서 설치한 뒤 `node_modules/expo-updates/build/`에서 `requireNativeModule`/`requireOptionalNativeModule` 호출부를 grep해 **실제 이름**(`ExpoUpdates` 계열로 예상되나 확인 필수)을 확인하고 그 문자열을 쓴다. dev-notes에 근거 라인을 남긴다.
- **top-level import 금지**(절대). 근거: 메모리 `native-module-lazy-require` + architecture §5 push S1 핫픽스.

### 3.4 순수 판정 유틸 `shouldCheckOta` (신규)

```ts
// src/features/ota/shouldCheckOta/shouldCheckOta.ts
/**
 * OTA 체크를 발화해도 되는지 판정(순수). 하나라도 막히면 false → 훅은 아무것도 안 한다.
 * @param isDev        __DEV__ (개발 번들러 구동 중)
 * @param hasModule    updatesModule 로드 성공 여부(네이티브 탑재)
 * @param isEnabled    Updates.isEnabled (빌드에서 업데이트 활성 — Debug/dev-client 빌드는 false)
 */
export const shouldCheckOta = ({
  isDev, hasModule, isEnabled,
}: { isDev: boolean; hasModule: boolean; isEnabled: boolean }): boolean;
```
- 규칙: `!isDev && hasModule && isEnabled` → true. 그 외 false. (3중 가드 — 개발 중 발화 방지 = 리더 요구 5.)

### 3.5 상태 훅 `useOtaUpdate` (신규)

```ts
// src/features/ota/useOtaUpdate/useOtaUpdate.ts
export const OtaStatus = {
  Idle: 'idle',               // 체크 전 / 미지원 / 업데이트 없음 / 무시됨 — UI 없음
  Checking: 'checking',       // checkForUpdateAsync 진행 중 — UI 없음
  Downloading: 'downloading', // fetchUpdateAsync 진행 중 — UI 없음(백그라운드)
  Ready: 'ready',             // 다운로드 완료 — 안내 노출 대상
  Reloading: 'reloading',     // 사용자가 "지금 적용" 탭 → reloadAsync 진행 중
} as const;
export type OtaStatus = (typeof OtaStatus)[keyof typeof OtaStatus];

export type OtaUpdateState = { status: OtaStatus };

export const useOtaUpdate: () => {
  state: OtaUpdateState;
  /** "지금 적용" — reloadAsync. 실패 시 idle 복귀(앱 계속 사용 가능). */
  applyUpdate: () => void;
  /** "나중에" — idle로 내림. 마운트 1회 구조라 같은 세션에 재노출되지 않는다. */
  dismiss: () => void;
};
```

**마운트 1회 흐름**(effect 명명 함수 `checkOtaOnMount`, deps `[]`):
1. `const updates = loadUpdatesModule()` → `shouldCheckOta({ isDev: __DEV__, hasModule: updates !== null, isEnabled: updates?.isEnabled ?? false })`가 false면 **즉시 반환**(status `idle` 유지, 네트워크 0).
2. `checking` → `await updates.checkForUpdateAsync()`.
   - `isAvailable === false` → `idle`(끝).
   - throw(오프라인·서버 오류·타임아웃) → `idle` + **조용히 흡수**(사용자에게 아무 표시 없음 = fail-open, 스토어 게이트와 동일 철학).
3. `downloading` → `await updates.fetchUpdateAsync()`.
   - `isNew === true` → `ready`. `false` → `idle`.
   - throw → `idle`(흡수).
4. `applyUpdate()` → `reloading` → `await updates.reloadAsync()`. throw → `idle` + `console.warn`(앱은 계속 동작, 다음 콜드스타트에 자동 적용됨).
5. `dismiss()` → `idle`.
- **언마운트 가드**: `mountedRef`로 async 완료 후 setState 보호(`useAppVersionGate.ts:31` 패턴 동일).
- **중복 실행 가드**: `initializedRef`(`usePushReceive.ts:57` 패턴) — 같은 마운트에서 두 번 체크하지 않는다.
- **폴링·타이머·AppState 리스너 0.**

### 3.6 안내 UI `OtaReadyDialog` (신규 — ui-publisher 소관)

```ts
// src/features/ota/OtaReadyDialog/OtaReadyDialog.tsx
export type OtaReadyDialogProps = {
  /** 표시 여부. false면 미렌더. */
  visible: boolean;
  /** "지금 적용" 탭 — reloadAsync 배선은 developer. */
  onApply: () => void;
  /** "나중에"/딤 탭 — dismiss 배선은 developer. */
  onDismiss: () => void;
};
```
- **셸 = `UpdateSuggestModal` 재사용 선례를 그대로 따른다**(킷 `templates/muklog`에 OTA 시안이 없음 → 킷 비종속 신설, `RenameDialog` 셸 톤). 근거: `app-version-gate` plan §4.2가 확립한 선례.
- **카피 draft**(최종 문구·톤은 ui-publisher가 ui-spec에서 확정, 해요체·구체 표현):
  - 제목: **"새 버전이 준비됐어요"**
  - 본문: **"지금 적용하면 앱이 잠깐 새로고침돼요. 작성 중인 내용이 있다면 저장한 뒤에 적용해 주세요."**
  - 버튼: **"나중에"** │ **"지금 적용"**(primary)
- `UpdateSuggestModal`(스토어 축)과 **다른 컴포넌트**다. 문구가 비슷해 보여도 합치지 않는다 — 두 축의 의미가 다르고(§4), 한쪽 변경이 다른 쪽에 새는 것을 막는다.
- 접근성: 액션은 `accessibilityRole="button"` + `testID="ota-apply"` / `testID="ota-dismiss"`. 테스트는 testID/role 기준(문구는 ui-spec 확정 후 채움).

### 3.7 두 축 조정용 컨텍스트 `appVersionGateStatus` (신규 — additive)

```ts
// src/features/appVersion/appVersionGateStatus/appVersionGateStatus.tsx
/** 스토어 게이트 현재 상태. Provider 밖에서는 'none'(안전 기본값 — 기존 소비처 회귀 0). */
export const useAppVersionGateStatus: () => VersionGateState['status'];  // 'checking'|'force'|'suggest'|'none'
export const AppVersionGateStatusProvider: ({ status, children }: { status: ...; children: ReactNode }) => JSX.Element;
```
- `AppVersionGate`가 자식을 이 Provider로 감싼다(**한 겹 추가 — 기존 렌더 분기·props·export 불변**). `OtaUpdateGate`가 `suggest` 억제 판정에 쓴다(§4.2).
- 기본값이 `'none'`이라 Provider 없이 렌더되는 기존 테스트·화면은 **영향 0**.

### 3.8 `eas.json` — 채널 (신규)

```jsonc
"build": {
  "development": { "developmentClient": true, "distribution": "internal", "channel": "development" },
  "preview":     { "distribution": "internal", "environment": "production", "android": { "buildType": "apk" }, "channel": "preview" },
  "production":  { "autoIncrement": true, "environment": "production", "ios": { "image": "latest" }, "channel": "production" }
}
```
- **세 프로필 모두 명시적으로 채널을 붙인다.** 근거: 채널 미지정 시의 EAS 기본 동작(프로필명 자동 채택 여부)은 로컬에서 확인할 수 없다 → **추측하지 않고 명시**한다. 명시하면 어느 버전의 EAS CLI에서도 동작이 확정된다.
- **development 프로필에 `development` 채널을 붙이되, OTA는 코드로 막는다.** Dev Client 빌드는 Debug 구성이라 `Updates.isEnabled`가 false일 것으로 예상되지만(→ `shouldCheckOta` false), **거기에만 의존하지 않는다**: `__DEV__` 가드가 2중, `development` 채널에는 **아무것도 발행하지 않는 운영 규칙**이 3중이다. (`isEnabled` 실측은 L5 라이브 이월.)
- 발행은 `production`/`preview` 채널로만. `eas update --branch <브랜치> --channel production` (§9).

---

## 4. 두 업데이트 축 — 역할 분리와 우선순위 (이 스프린트의 핵심 통합 계약)

### 4.1 어느 축인가 — 판정 기준표 (architecture §7에 그대로 옮김, T9)

| 변경 내용 | 축 | 왜 |
|---|---|---|
| `src/**` JS/TS 로직·화면·스타일 수정 | **OTA** | JS 번들만 바뀜 |
| 카피(문구)·색·간격·아이콘 컴포넌트 수정 | **OTA** | 상동 |
| `assets/**` 이미지·폰트 교체/추가 | **OTA** | asset은 번들에 포함되어 OTA로 전달됨. ⚠️ 대역폭 영향(§8) |
| Supabase 쿼리·RPC 호출부·Edge Function **호출 코드** 수정 | **OTA** | 클라 JS |
| Edge Function·마이그레이션 자체 배포 | **어느 축도 아님** | `supabase functions deploy`/`db push`(별도 경로) |
| `package.json`에 **네이티브** 모듈 추가/제거/버전 변경(`expo-*` 대부분, `react-native-*`) | **스토어** | 바이너리에 코드가 들어가야 함 |
| `app.json` `plugins`·권한 문구·`ios`/`android` 설정·스킴·아이콘/스플래시 | **스토어** | 네이티브 config 변경 |
| `plugins/*.js`(withFmtConstevalFix·withAndroidLaunchMode) 변경 | **스토어** | prebuild 산출물 변경 |
| Expo SDK / React Native 버전 업그레이드 | **스토어** | 네이티브 전면 변경 |
| `app.json` `version` 변경 | **스토어** | 정의상 새 런타임(§3.1) |
| 순수 JS 라이브러리 추가(`date-fns` 류, 네이티브 코드 없음) | **OTA** | JS 번들에만 포함. 단 **네이티브 코드 유무를 반드시 확인**한 뒤 |

> **판단이 애매하면 스토어 축으로 간다.** OTA 오배포는 비호환 크래시로 이어지고, 스토어 축 오판은 배포가 늦어질 뿐이다.

### 4.2 동시 발화 시 우선순위 (구현 계약)

| 스토어 게이트 상태 | OTA 체크·다운로드 | OTA 안내 다이얼로그 | 구현 |
|---|---|---|---|
| `force`(강제 차단) | **하지 않음** | **띄우지 않음** | `OtaUpdateGate`가 `AppVersionGate`의 **children 안쪽**에 놓인다(§3.7 배치) → force면 `ForceUpdateScreen`이 children을 대체하므로 `OtaUpdateGate`가 **애초에 마운트되지 않는다**. 체크 자체가 발생하지 않음 |
| `suggest`(권유 모달 노출 중) | **함**(백그라운드) | **띄우지 않음**(억제) | `OtaUpdateGate`가 `useAppVersionGateStatus() === 'suggest'`면 다이얼로그를 렌더하지 않는다. 다운로드분은 **다음 콜드스타트에 자동 적용**되므로 사용자 마찰 0으로 효과는 유지 |
| `checking` | 함 | ready면 띄움 | fail-open(스토어 게이트와 동일 철학). 뒤늦게 `force`가 확정되면 children이 통째로 언마운트되어 안내도 함께 사라진다 |
| `none`(ok·unknown·dismiss됨) | 함 | ready면 띄움 | 정상 경로 |

> **[각주 — 구현 중 확정, 2026-07-27]** 표가 규정하지 않은 전이가 하나 있다: **`suggest` → (사용자가 "나중에"로 스토어 모달을 닫음) → `none`**. 이때 억제가 풀려 **OTA 안내가 곧바로 이어서 뜬다.** 리더 확정 = **의도된 동작**(동작 변경 없음). 근거: 두 안내는 의미가 다르고(스토어=새 바이너리 다운로드 / OTA=이미 받아둔 번들을 지금 적용) 화면에서 겹치지 않으며, 여기서 한 번 더 억제하면 사용자는 다음 콜드스타트까지 개선을 못 받는다. 회귀 가드 = `OtaUpdateGate.spec.tsx`의 `suggest → none` 전이 케이스, 문서 = architecture §7 (A-2).

- **왜 force에서 체크조차 안 하나**: 강제 차단 상태에서는 앱을 쓸 수 없으니 OTA를 받아도 의미가 없고, 대역폭(무료 티어 100 GiB)만 쓴다.
- **왜 suggest에서 안내만 막나**: 모달 2개가 겹치면 사용자가 어느 쪽이 "진짜" 업데이트인지 알 수 없다. 스토어 축이 상위(네이티브 포함)이므로 화면은 스토어 축에 양보하고, OTA는 조용히 준비만 해둔다.
- **`force`가 늦게 확정될 때 in-flight fetch**: 언마운트되어도 네이티브 다운로드는 계속될 수 있다 — 무해(다운로드분은 그 런타임에서만 유효하고, 강제 업데이트로 새 바이너리를 깔면 런타임이 달라져 폐기된다).

### 4.3 적용 UX (확정)

```
콜드스타트
  └ (가드 통과 시) checkForUpdateAsync ─ 없음/실패 → 끝(UI 없음)
        └ 있음 → fetchUpdateAsync(백그라운드, UI 없음)
              └ 완료 → [새 버전이 준비됐어요]  ← 유일한 사용자 접점
                    ├ "지금 적용" → reloadAsync → 새 번들로 재시작
                    └ "나중에"    → 사라짐. 다음 앱 실행 때 자동으로 적용됨
```
- **스플래시 blocking 없음 · 자동 reload 없음 · 폴링 없음.**
- 체크·다운로드 중에는 **아무 UI도 없다**(스피너조차). 사용자는 평소처럼 앱을 쓴다.
- 안내는 **세션당 최대 1회**(마운트 1회 + `initializedRef`). 무시해도 같은 세션에 다시 뜨지 않는다.

### 4.4 배치 (App.tsx)

```tsx
<AppVersionGate>            {/* 스토어 축: force면 children 전체 대체 */}
  <OtaUpdateGate>           {/* OTA 축: children + (조건부) OtaReadyDialog */}
    <AuthGate />
  </OtaUpdateGate>
</AppVersionGate>
```
- `OtaUpdateGate`는 항상 `children`을 그대로 렌더하고, `state.status === 'ready' && storeGateStatus !== 'suggest'`일 때만 `OtaReadyDialog`를 오버레이한다. **앱 진행을 절대 막지 않는다.**

---

## 5. 작업 목록 (담당 · 인수조건 · 테스트 · 의존)

### 인프라 (developer / qa-logic)
- [ ] **T1. [dev] `expo-updates` 설치 + `app.json` 설정** — 의존: 없음.
  인수조건: ① `npx expo install expo-updates`로 SDK 52 호환 버전이 `package.json` dependencies에 고정된다(정확 버전은 dev-notes 기록) ② `app.json > expo`에 §3.2의 `updates` 블록(url·enabled·checkAutomatically `ON_ERROR_RECOVERY`·fallbackToCacheTimeout `0`)과 `runtimeVersion: {policy:"appVersion"}`이 추가된다 ③ `updates.url`의 project id가 `extra.eas.projectId`(`ddb39563-...`)와 **일치** ④ 기존 `plugins`·`version`·`ios`/`android` 키 **무변경**.
  테스트: `app.json`을 읽어 계약 단언(`appConfigMigration.spec.ts`의 "설정 파일 문자열 계약" 패턴) — 5개 필드 값 + projectId 일치 + `version === '1.2.0'` 유지 + plugins 배열 길이·구성 불변.
- [ ] **T2. [dev] `eas.json` 채널** — 의존: 없음(T1과 병렬).
  인수조건: development/preview/production 세 프로필에 각각 `channel: "development"|"preview"|"production"`이 붙고, `cli.appVersionSource`·기존 프로필 키는 **무변경**.
  테스트: `eas.json` 읽어 계약 단언 — 3채널 값 + `appVersionSource === 'remote'` 유지 + `production.autoIncrement === true` 유지.

### 로직 (developer / qa-logic)
- [ ] **T3. [dev] `updatesModule` 안전 로더** — 의존: T1.
  인수조건: ① 네이티브 probe 실패 → `null` 반환, **`require('expo-updates')` 자체를 호출하지 않음** ② require가 throw → `null`(예외 밖으로 안 나감) ③ 정상 → `isEnabled`·`checkForUpdateAsync`·`fetchUpdateAsync`·`reloadAsync`를 가진 객체 ④ **top-level import 0**(파일 상단 import는 `expo-modules-core`만) ⑤ 네이티브 모듈명은 설치된 `node_modules/expo-updates` 소스에서 확인한 실제 문자열(dev-notes에 grep 근거).
  테스트: `expo-modules-core`의 `requireOptionalNativeModule` 모킹 — null → `loadUpdatesModule()` null & `expo-updates` 미접촉 / probe 성공 + require throw → null / 정상 → 모듈. 파일 소스에 top-level `from 'expo-updates'`가 없음을 단언.
- [ ] **T4. [dev] `shouldCheckOta` 순수 유틸** — 의존: 없음.
  인수조건: `!isDev && hasModule && isEnabled`만 true, 나머지 7조합 전부 false.
  테스트: 2×2×2 = 8조합 전수.
- [ ] **T5. [dev] `useOtaUpdate` 훅** — 의존: T3·T4.
  인수조건: ① 가드 false → status `idle` 유지 + `checkForUpdateAsync` **미호출**(네트워크 0) ② available false → `idle` ③ available true → `downloading` 거쳐 fetch `isNew:true` → `ready` ④ fetch `isNew:false` → `idle` ⑤ check/fetch throw → `idle`(throw 밖으로 안 나감, UI 없음) ⑥ `applyUpdate()` → `reloadAsync` 1회 호출 ⑦ `reloadAsync` throw → `idle` 복귀 ⑧ `dismiss()` → `idle` ⑨ 마운트당 `checkForUpdateAsync` **정확히 1회**(폴링 0) ⑩ 언마운트 후 setState 경고 0.
  테스트: `loadUpdatesModule` 모킹 + `__DEV__` 제어 — 위 10항목 각각. 타이머·AppState 리스너 미등록 단언.
- [ ] **T6. [dev] `appVersionGateStatus` 컨텍스트 + `AppVersionGate` 래핑** — 의존: 없음.
  인수조건: ① Provider 밖 `useAppVersionGateStatus()` → `'none'` ② `AppVersionGate`가 `state.status`를 자식에게 제공 ③ `AppVersionGate`의 기존 렌더 분기(force→ForceUpdateScreen / suggest→children+모달 / 그 외 children)·props·export **완전 불변**, 기존 `AppVersionGate.spec.tsx` 무수정 통과.
  테스트: Provider 유무별 기본값 / gate 상태별 컨텍스트 값 / 기존 spec 회귀.

### UI (ui-publisher / qa-visual)
- [ ] **T7. [ui] `OtaReadyDialog`** — 의존: 없음(T5와 병렬).
  인수조건: ① `UpdateSuggestModal` 셸(딤 backdrop + 중앙 카드 + 상단 hairline 2버튼 행) 정합 ② 입력 없음, 2버튼("나중에" │ "지금 적용" primary) ③ "지금 적용"→`onApply` 1회, "나중에"/딤→`onDismiss` 1회 ④ `visible:false`면 미렌더 ⑤ raw hex 0(토큰만), 해요체, ~~브랜드 코럴~~ → **브랜드 파랑**(`--mk-accent` #3366FF / `--mk-accent-strong` #1F4FE0)·헤어라인·radius 킷 톤 <sub>(리더 정정 2026-07-28 — qa-visual 지적: 킷에 코럴 액센트 없음. 구현은 `accentStrong`을 써 킷 정합이므로 통과)</sub> ⑥ 본문에 "작성 중인 내용 저장" 안내 포함(입력 유실 방지 — §3.6).
  검증: 셸 비주얼 정합(qa-visual), 콜백 배선·`testID` 존재(qa-logic).

### 배선 (developer / qa-logic)
- [ ] **T8. [dev] `OtaUpdateGate` + `App.tsx` 배선** — 의존: T5·T6·T7.
  인수조건: ① 항상 `children` 렌더(앱 진행 차단 0) ② `ready` && storeGateStatus `!== 'suggest'` → `OtaReadyDialog` 오버레이 ③ `ready` && `'suggest'` → **다이얼로그 미렌더**(children만) ④ idle/checking/downloading/reloading → 다이얼로그 미렌더 ⑤ `App.tsx` 트리가 `<AppVersionGate><OtaUpdateGate><AuthGate/></OtaUpdateGate></AppVersionGate>` ⑥ force 시 `OtaUpdateGate`가 마운트되지 않아 `useOtaUpdate`의 체크가 발생하지 않음.
  테스트: 상태×storeGateStatus 조합별 다이얼로그 렌더/미렌더, App 트리 배선, force 시 `checkForUpdateAsync` 미호출.

### 문서 (developer)
- [ ] **T9. [dev] `docs/design/architecture.md` 갱신** — 의존: T1~T8.
  인수조건: ① **§1 결정 표**에 "앱 업데이트 2축(스토어 바이너리 / EAS Update OTA)" 행 추가(runtimeVersion `appVersion` 정책·근거 포함) ② **§5 백로그**에 `expo-updates-ota` 행 추가(상태·산출물·라이브 이월) ③ **§6 비용 가드레일**에 EAS Update 항목 추가(§8 draft 문구 그대로) ④ **§7**에 "OTA 운영 절차" 항목 추가 — §4.1 판정 기준표 + §9 배포 순서 + 롤백 + 두 축 우선순위 + "네이티브 변경 시 반드시 `version` bump" 규칙 ⑤ CLAUDE.md 변경 이력 표에 1행 추가.
  테스트: 문서(테스트 대상 아님) — qa-logic이 §4·§8·§9와의 일치를 육안 교차검증.

### 회귀 (developer)
- [ ] **T10. [dev] 회귀 0** — 의존: 전부.
  인수조건: `npm test` **전체 green** + `npx tsc --noEmit` **0 에러**. `AppVersionGate`·`useAppVersionGate`·`UpdateSuggestModal`·`ProfileScreen`·`App.tsx` 기존 동작 무변경(컨텍스트 Provider 1겹·게이트 1겹 추가 외).

> **순서**: T1 ∥ T2 → T3 → T4 → T5 → (T6 ∥ T7) → T8 → T9 → T10.
> **ui-publisher 몫은 T7 하나**다(+T8의 다이얼로그 문구 최종 확정). 나머지는 전부 developer. 킷에 OTA 시안이 없으므로 T7은 **킷 비종속 + `UpdateSuggestModal` 셸 재사용** 선례를 따른다.

---

## 5-1. 테스트 케이스 (TDD — jest-expo + @testing-library/react-native)

**단위(반드시 자동 테스트)**
- `shouldCheckOta`(T4): 8조합 전수(정상 1 / 경계·실패 7).
- `updatesModule`(T3): probe null(→ require 미호출) / require throw / 정상 3케이스 + top-level import 부재 단언.
- `useOtaUpdate`(T5): 정상(available→fetch→ready→apply→reload) / 경계(available false·isNew false·가드 false) / 실패(check throw·fetch throw·reload throw) / 호출 횟수(check 1회·reload 1회) / 언마운트 setState 가드.
- `appVersionGateStatus`(T6): Provider 밖 기본값 `'none'` / 4상태 전달 / 기존 `AppVersionGate.spec.tsx` 무수정 통과.
- `OtaReadyDialog`(T7): visible 분기 / onApply·onDismiss 1회 / 딤 탭 dismiss / 버튼 2개 존재.
- `OtaUpdateGate`(T8): (ready, none)→다이얼로그 O / (ready, suggest)→X / (idle·checking·downloading·reloading, *)→X / children 항상 렌더 / force 시 미마운트 → check 미호출.
- 설정 계약(T1·T2): `app.json`·`eas.json` 필드 단언 + 기존 키 불변.
- 회귀(T10): 기존 전체 spec green + `tsc --noEmit`.

**모킹/스모크(단위 불가 — 반드시 "라이브 검증 이월"로 표기)**
| ID | 검증 대상 | 방법 | 왜 단위로 못 하나 |
|----|-----------|------|-------------------|
| **L1** | `expo-updates` 네이티브 모듈 실제 이름 · `Updates.isEnabled` 실측값 | 설치 후 소스 grep + Dev Client/스토어 빌드 실행 | 설치 전엔 존재하지 않음 |
| **L2** | EAS 빌드 로그의 `Resolved runtime version` = `1.2.0` (appVersionSource remote와 무충돌 확증) | `eas build --profile production` 로그 확인 | EAS 서버에서만 해석 |
| **L3** | 빌드 산출물의 채널 = 프로필 채널, `eas update --channel production` 수신 | EAS 대시보드 + 실기기 | 원격 인프라 |
| **L4** | **실제 OTA 수신 → 다운로드 → 안내 → reload로 새 번들 반영** | 같은 runtimeVersion 스토어/preview 빌드에 `eas update` 발행 후 실기기 | 네이티브 런타임 동작 |
| **L5** | Dev Client(Debug) 빌드에서 OTA **미발화**(`isEnabled` false) | `npm run ios:sim` 후 로그 | 네이티브 빌드 구성 의존 |
| **L6** | **다른 runtimeVersion(예 1.3.0)에 발행한 업데이트가 1.2.0 빌드에 도달하지 않음** (런타임 격리 확증 — 가장 중요) | 1.3.0 채널 발행 후 1.2.0 기기 확인 | 서버 매칭 로직 |
| **L7** | EAS Update 사용량(MAU·대역폭) | expo.dev 대시보드 | 원격 계측 |
| **L8** | 강제 업데이트(force) 화면이 떠 있을 때 OTA 안내가 안 뜨고 체크도 안 됨 | `app_config.min_supported_version` 임시 상향 + 실기기 | 실 DB + 네이티브 조합 |

---

## 6. 엣지케이스

- **오프라인 콜드스타트**: `checkForUpdateAsync` throw → `idle`, **UI 없음**. 앱 정상 사용(fail-open). 온라인 복귀 후 다음 콜드스타트에 재시도.
- **체크는 성공, 다운로드 중 네트워크 끊김**: `fetchUpdateAsync` throw → `idle`, UI 없음. 다음 콜드스타트에 처음부터 재시도(부분 다운로드는 네이티브가 관리, 우리 상태는 멱등).
- **다운로드 중 사용자가 앱 종료**: 우리 상태는 사라지고 네이티브 다운로드가 끝났다면 **다음 콜드스타트에 자동 적용**된다. 그때 `checkForUpdateAsync`는 `isAvailable:false`(이미 최신) → 안내 안 뜸. 중복 안내 0.
- **다운로드 완료 후 사용자가 "나중에"**: 같은 세션 재노출 없음(마운트 1회). **다음 앱 실행 때 자동 적용**되므로 업데이트가 유실되지 않는다.
- **같은 세션 반복 안내 방지**: `initializedRef` + effect deps `[]`. 화면 전환·리렌더로 재체크되지 않는다.
- **강제 업데이트(force)와 동시 발화**: OTA 게이트가 children 안쪽이라 **마운트조차 안 됨** → 안내 0, 체크 0, 대역폭 0(§4.2).
- **스토어 권유(suggest)와 동시 발화**: 다운로드는 진행, **안내만 억제**. 모달 2개 겹침 없음.
- **사용자가 먹로그 작성 중(MuklogEditor 입력·사진 선택) 안내가 뜸**: 자동 reload를 하지 않으므로 입력 유실 없음. 다이얼로그 본문이 저장을 권한다(§3.6). "나중에"를 누르면 그대로 작업 계속.
- **`reloadAsync` 실패**: `idle` 복귀 + `console.warn`. 앱은 계속 동작하고 다음 콜드스타트에 자동 적용.
- **Dev Client / Expo Go / 테스트 환경(네이티브 미탑재)**: `loadUpdatesModule()` null → 아무 동작 없음, throw 0, 로그 0. **현재 설치된 앱에도 영향 0**.
- **개발 중(`__DEV__`) Metro 번들 사용**: `shouldCheckOta` false → 발화 0.
- **`runtimeVersion` 불일치**(1.2.0 기기에 1.3.0용 업데이트): 서버가 매칭하지 않아 `isAvailable:false` → 안내 0. **L6로 반드시 실증**한다.
- **커플 동시성(2명 동시 사용)**: OTA는 각 기기의 로컬 판정이며 공유 데이터 읽기·쓰기 0 → 동시성 영향 0. 다만 **두 사람의 앱 JS 버전이 일시적으로 다를 수 있다** → OTA로 배포하는 변경은 **DB 스키마·RPC 계약과 후방호환**이어야 한다(운영 규칙, T9에서 architecture §7에 기록).
- **OTA와 마이그레이션의 순서**: 새 JS가 새 컬럼·새 RPC를 쓰면 **마이그레이션·Edge Function을 먼저 배포**한 뒤 OTA를 발행한다(반대 순서는 구 스키마에 신 JS가 붙어 즉시 오류). §9 배포 순서에 명문화.
- **잘못된 OTA를 발행한 경우**: 롤백 절차 §9-3.
- **권한/RLS**: 이 기능은 Supabase를 전혀 건드리지 않는다(DB 접근 0) → RLS 영향 0.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

**qa-logic(로직·통합)**
- `app.json updates.url`(project id) ↔ `extra.eas.projectId` ↔ `eas.json channel` ↔ EAS 대시보드: 세 곳의 식별자·채널 정합.
- `app.json runtimeVersion.policy` ↔ `@expo/config-plugins` 해석 규칙(§3.1 표) ↔ `eas.json appVersionSource` ↔ **스토어 게이트가 쓰는 `version`**: 같은 `1.2.0` 문자열을 두 축이 각각 어떻게 쓰는지, 서로를 읽지 않는지.
- `updatesModule`(로더) ↔ `shouldCheckOta`(판정) ↔ `useOtaUpdate`(소비): 미탑재·개발·비활성 3경로에서 **네트워크 호출 0**임을 실제 단언으로 확인(껍데기 단언 금지 — testing-strategy §좋은 테스트).
- `useOtaUpdate` 상태머신 ↔ `OtaUpdateGate` 렌더 분기 ↔ `OtaReadyDialog` props: 5상태 × 다이얼로그 노출 매트릭스(§4.2 표) 완전 일치.
- `useAppVersionGate`(state.status) ↔ `AppVersionGateStatusProvider` ↔ `useAppVersionGateStatus` ↔ `OtaUpdateGate` 억제 판정: **suggest 억제·force 미마운트**가 실제로 성립하는지 양쪽을 같이 읽고 확인.
- `App.tsx` 프로바이더/게이트 중첩 순서: `AppVersionGate` → `OtaUpdateGate` → `AuthGate`. 순서가 뒤집히면 force 우선순위가 깨진다(**최우선 점검 항목**).
- **네이티브 안전 규칙 준수**: `expo-updates` top-level import가 코드베이스 어디에도 없는지 전수 grep(메모리 `native-module-lazy-require`).
- **비용 가드레일**: 폴링·타이머·AppState 리스너 0 / 콜드스타트당 check 정확히 1회 / force 시 0회 / AWS 0 / Supabase 호출 0.
- 기존 `appVersion` 피처 회귀 0(spec 무수정 통과 여부).

**qa-visual(비주얼 충실도)**
- `OtaReadyDialog` ↔ `UpdateSuggestModal`/`RenameDialog` 셸: 딤 불투명도·카드 radius(16)·hairline 보더·버튼 행 분할·타이포 스케일·좌우 패딩 정합.
- 카피 톤: 해요체·구체 표현·킷 문체(`templates/muklog`). 스토어 권유 모달과 **문구가 혼동되지 않는지**(두 축이 다른 의미임이 사용자에게 전달되는지).
- raw hex 0(토큰만), 브랜드 코럴 사용 지점.
- 디바이스 스모크: 다이얼로그가 safe-area·키보드·다크 배경 위에서 정상 표시.

---

## 8. 비용 가드레일 체크

- **AWS 미사용** — 변동 없음. OTA 호스팅은 Expo(EAS Update) 인프라.
- **EAS Update 무료 티어**(2026-07-27 `expo.dev/pricing` 확인): **MAU 1,000 / 글로벌 엣지 대역폭 100 GiB / 스토리지 20 GiB.** 초과 시 대역폭 $0.10 per GiB · 스토리지 $0.05 per GiB. 다음 등급(Starter $19/월)은 MAU 3,000. → **muklog의 현재 사용자 규모(출시 초기, 커플 단위)에서는 무료 티어 안에서 충분**하나, MAU 1,000 접근 시 알림이 필요하다(L7 대시보드 모니터링).
- **폴링 0** — 콜드스타트 1회 `checkForUpdateAsync`만. AppState·타이머·Realtime 0. 네이티브 자동 체크도 `checkAutomatically: "ON_ERROR_RECOVERY"`로 껐다(§3.2).
- **force 시 체크 0** — 강제 차단 상태에선 요청조차 보내지 않는다(§4.2).
- **전송량** — 업데이트는 **변경된 JS 번들 + 변경된 asset만** 내려받는다(미변경 asset은 해시가 같아 재다운로드되지 않는다). 현재 `assets/`는 약 13 MB이고 `assetBundlePatterns: "**/*"`라 **대량 asset 교체는 곧 대역폭 급증**이다 → asset을 크게 바꾸는 변경은 OTA보다 스토어 릴리스에 묶는 편이 낫다(운영 규칙, T9).
- **Supabase 호출 0 · Kakao 호출 0 · 이미지 처리 0** — 본 기능 무관.

> **architecture §6에 추가할 문구(draft — T9에서 그대로 반영):**
> - **EAS Update(OTA)**: 무료 티어 = **MAU 1,000 / 엣지 대역폭 100 GiB / 스토리지 20 GiB**(2026-07-27 확인, 초과 시 $0.10·$0.05 per GiB). 앱은 **폴링 0** — 콜드스타트 1회만 확인하고, 강제 업데이트 차단 중에는 확인조차 하지 않는다. 업데이트 payload는 변경된 JS 번들 + 변경된 asset만 전송되므로, **대량 asset 교체는 OTA가 아니라 스토어 릴리스에 묶는다**. AWS 0 유지.

---

## 9. 산출물 / 완료 기준 / 운영 절차

### 9-1. 산출물
- **신규**: `src/features/ota/`(`updatesModule`·`shouldCheckOta`·`useOtaUpdate`·`OtaReadyDialog`·`OtaUpdateGate` + 각 `*.spec` + 배럴 `index.ts`) / `src/features/appVersion/appVersionGateStatus/`(컨텍스트 + spec).
- **수정**: `app.json`(updates·runtimeVersion) / `eas.json`(channel ×3) / `package.json`(expo-updates) / `App.tsx`(게이트 1겹) / `src/features/appVersion/AppVersionGate/AppVersionGate.tsx`(Provider 1겹) + `index.ts` export / `docs/design/architecture.md` / `CLAUDE.md` 변경 이력.
- **문서**: `ui-spec.md`(T7 카피·셸 근거) · `dev-notes.md`(설치 버전·네이티브 모듈명 grep 근거·라이브 이월 목록) · `qa-report-logic.md` ∥ `qa-report-visual.md`.

### 9-2. 완료 기준
- T1~T10 green + **`npm test` 전체 통과** + **`npx tsc --noEmit` 0 에러**.
- qa-logic ∥ qa-visual 병렬 통과.
- L1~L8 라이브 이월 항목이 dev-notes와 qa-report에 **명시적으로 목록화**(이 프로젝트는 라이브에서만 드러나는 버그 전례가 많다).

### 9-3. 운영 절차 (사용자 전담 — architecture §7에 기록)

**A. 최초 활성화(딱 한 번, 순서 엄수)**
1. `npx expo prebuild --clean`(또는 EAS 빌드) — `ios/`·`android/`는 gitignore된 CNG 산출물이라 `expo-updates` 플러그인 반영을 위해 재생성이 필요하다.
2. `eas build --profile production` — **로그에서 `Resolved runtime version` = `1.2.0` 확인(L2)**.
3. 스토어 심사·배포 → **`expo-updates`가 포함된 빌드가 사용자 기기에 깔린 뒤에야** OTA가 가능해진다.
4. 그 전까지 `eas update` 발행 금지(도달 대상이 0이라 무의미하고, 런타임 매칭 오해를 부른다).

**B. 평소 OTA 배포 순서**
1. §4.1 판정 기준표로 **OTA 축이 맞는지** 확인. 애매하면 스토어 축.
2. 새 JS가 새 스키마·새 RPC·새 Edge Function을 쓰면 **그것들을 먼저 배포**(`supabase db push` / `functions deploy`).
3. `eas update --branch <브랜치> --channel production --message "<변경 요약>"`.
4. 실기기에서 콜드스타트 → 안내 → "지금 적용" 확인.
> **주의**: OTA는 커플 두 사람에게 동시에 도달하지 않는다(각자 콜드스타트 시점). **DB 계약과 후방호환**인 변경만 OTA로 보낸다.

**C. 롤백**
- 원칙: **다시 OTA로 덮는 것이 가장 빠르다** — 직전 정상 커밋에서 `eas update`를 한 번 더 발행.
- EAS CLI가 제공하는 수단(`eas update:republish`로 이전 그룹 재발행 / `eas update:roll-back-to-embedded`로 빌드에 내장된 번들로 되돌리기)도 있으나, **정확한 서브커맨드·옵션은 사용 시점에 `eas update --help`로 확인**한다(버전에 따라 다를 수 있음 — 추측 금지).
- OTA가 앱을 못 켜게 만든 경우: `checkAutomatically: "ON_ERROR_RECOVERY"` 덕분에 크래시 후 재실행 시 네이티브가 자체적으로 새 업데이트를 확인한다 → 수정본을 즉시 발행하면 복구 경로가 있다. 그래도 **최후 수단은 스토어 재배포**임을 인지한다.

**D. 두 축의 관계 요약(운영자용 한 문장)**
> `app.json`의 `version`을 올리면 → 새 런타임 = **스토어 심사 필요**. `version`을 그대로 두고 JS만 고치면 → 같은 런타임 = **OTA로 즉시 배포**. **네이티브를 건드렸는데 `version`을 안 올리는 것이 유일한 금지 조합이다.**

---

## 10. 리더 확인이 필요한 미결 항목

- **Q1(중요). 첫 OTA 대상 빌드를 어떻게 만들 것인가.** 현재 스토어의 1.2.0 빌드에는 `expo-updates`가 없다. `runtimeVersion` 정책이 `appVersion`이므로 **`version`을 1.2.0으로 유지한 채 재빌드**하면 "같은 1.2.0인데 OTA 가능/불가능한 두 바이너리"가 공존한다(구 바이너리는 업데이트를 못 받을 뿐이라 **무해**하지만, 운영 추적이 헷갈린다). **권고: 다음 릴리스에서 `version`을 `1.3.0`으로 올리며 `expo-updates`를 함께 심는다** — 이러면 "1.3.0부터 OTA 가능"이 깔끔하게 성립한다. 리더 결정 필요.
- **Q2. 포그라운드 복귀 시 재확인을 정말 후속으로 미룰 것인가**(§2 Out-of-scope 근거 참조). 미루면 OTA가 사용자에게 닿는 데 최대 "다음 콜드스타트"까지 걸린다.
- **Q3. `preview` 채널 운영 여부.** 채널 설정은 해두지만(§3.8), 실제로 preview 빌드에 OTA를 발행해 내부 테스트를 돌릴지는 운영 정책이다. 안 쓸 거라면 설정만 두고 발행하지 않으면 된다(비용 0).
- **Q4(후속). `fingerprint` 정책으로의 이전 시점.** `appVersion`은 "네이티브 변경 시 version bump"라는 **사람 규율**에 의존한다. 규율이 한 번이라도 깨지면 비호환 OTA가 나간다. 프로젝트가 커지면 `fingerprint`로 옮기는 것이 안전하나, §3.1의 세 가지 미검증 요인(커스텀 플러그인·`ios:sim` 경로·가독성) 때문에 이번엔 미룬다.
