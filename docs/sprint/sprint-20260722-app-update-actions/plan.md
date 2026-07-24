# Sprint: 앱 업데이트 액션 정비 (app-update-actions)

> 단일 출처: `docs/design/architecture.md`(§1 결정·§3 데이터 모델 `app_config`·§6 비용 가드레일·§7 운영 절차 line 282) · 선행 스프린트 `docs/sprint/sprint-20260702-app-version-gate/`(plan·ui-spec·dev-notes) · 현재 코드(UpdateSuggestModal·AppVersionGate·useAppVersionGate·fetchAppConfig·resolveVersionGate·currentAppVersion·ProfileScreen·AppVersionRow).
> 이 스프린트는 **버그 정비**다: `app-version-gate` 인프라는 정상 동작하나 ① DB 시드가 `store_url_ios`를 null로 두어 권유 모달이 스토어로 못 가고 ② 설정 화면에 업데이트 액션이 없다. 인프라를 새로 만들지 않고 **DB 값 + 설정 화면 액션**만 정비한다.
> 파이프라인: **planner → (ui-publisher ∥) developer → qa(qa-visual ∥ qa-logic)**. 신설 UI 최소(설정 행에 업데이트 액션 1개 — ui-publisher 톤·문구 소관).
> git 작업 없음. TDD(인수조건 = 테스트 케이스, Red 먼저). 종료 기준 `npm test` + `tsc --noEmit`. 비용 가드레일 최우선(AWS 0·폴링 0).

---

## 0. 배경 — 확정 진단 (리더 진단 코드로 검증 완료)

**결함 1 — 권유 모달 "확인" 눌러도 스토어 이동 안 됨.**
배선은 정상이다: `AppVersionGate.tsx:22-25`의 `openStore`가 `Linking.openURL(storeUrl)`을 호출하고, suggest 시 `UpdateSuggestModal`에 `storeUrl`을 넘긴다. 근본 원인은 **DB 값**이다 — 선행 마이그레이션 `supabase/migrations/20260702120000_app_config.sql:24-26`의 시드가 `store_url_ios`를 null로 남긴다("미출시"). storeUrl이 null이면 `UpdateSuggestModal.tsx:119-133`이 "나중에│업데이트" 2버튼 대신 **닫기만 하는 단일 "확인"** 버튼을 렌더한다 → 사용자 증상과 정확히 일치. 앱은 2026-07 iOS 출시됨 → DB에 스토어 URL을 채우면 해소된다(코드 변경 불필요).

**결함 2 — 설정(ProfileScreen)에 업데이트 액션 없음.**
`ProfileScreen.tsx:205`가 `getCurrentAppVersion()`(동기, `expo-constants`)만 호출하고 `AppVersionRow`(line 356)는 **표시 전용**이다(`AppVersionRow.tsx` — 버전 텍스트만). 설정 행은 최신 버전 존재 여부·스토어 URL을 전혀 모른다 → "업데이트하기" 액션을 노출할 수 없다.

**현재 버전:** app.json `version` = **`1.2.0`**. 선행 시드 latest=`1.0.0` → `resolveVersionGate`는 `1.2.0 >= 1.0.0` = **ok**. 즉 URL만 채우면 지금 당장은 설정 행이 "최신"으로 표시되고 권유 모달은 dormant다(정상). 다음 릴리스에서 운영자가 `latest_version`을 올릴 때(§7 배포 순서) 비로소 권유·업데이트 액션이 활성화되고, 그때 URL이 채워져 있어 스토어 이동이 정상 동작한다. **이 스프린트는 그 순간을 대비해 URL을 채우고 설정 액션을 배선한다.**

---

## 1. 기능 한줄 정의

iOS 스토어 URL을 `app_config`에 채워 업데이트 권유 모달이 스토어로 이동하게 하고, 설정 화면 앱 버전 영역에서 **최신 버전이 있으면 "업데이트하기" 액션**(탭 시 스토어 이동)을, 최신이면 최신 상태를 노출한다. 판정·조회는 기존 생산자(`fetchAppConfig`·`resolveVersionGate`·`getCurrentAppVersion`)를 재사용한다.

---

## 2. 범위

### In-scope
- **(a) DB 스토어 URL 반영** — 신규 마이그레이션이 `app_config.store_url_ios`에 확정 URL을 넣는다(UPSERT). Android는 미출시 → null 유지. `min/latest`·`store_url_android` 미변경.
- **(b) 설정 화면 업데이트 액션** — ProfileScreen이 마운트 1회 `app_config`를 조회해 판정하고, `AppVersionRow`가 상태별로 렌더: 최신 아님+스토어URL 있음 → "업데이트하기" 액션(탭 → 스토어) / 최신 → 최신 상태 라벨 / 미확보·조회실패 → 버전만.
- **신규 모듈:** `useAppUpdateStatus`(설정용 판정 훅 — dismissal 미참조). `AppVersionRow` props 확장. 신규 마이그레이션 파일 + SQL 계약 spec.

### Out-of-scope (일부러 안 함)
- **UpdateSuggestModal·AppVersionGate·useAppVersionGate·ForceUpdateScreen 코드 변경** — 결함 1은 순수 DB 값 문제. 게이트 배선은 정상이므로 손대지 않는다(회귀 리스크 0).
- **Android 스토어 URL** — 미출시 → null 유지(출시 시 후속 UPDATE 마이그레이션 1줄).
- **`latest_version`/`min_supported_version` 변경** — 릴리스마다 운영자가 SQL/대시보드로 관리(§7 배포 순서). 마이그레이션이 게이트를 활성화하지 않는다.
- **게이트 fetch와 설정 fetch 공유(dedup)** — 1행 select 비용은 무시 가능, 공유 캐시/컨텍스트는 결합도만 올린다(§8 근거). 각각 마운트 1회.
- **폴링/Realtime/자동 재조회** — 앱 재시작 시 재판정.
- **인앱 업데이트 API**(iOS/Android In-App Update) — 단순 스토어 Linking만.

---

## 3. 데이터 · API 계약

### 3.1 신규 마이그레이션 — iOS 스토어 URL 반영

**파일:** `supabase/migrations/20260722120000_app_config_store_url_ios.sql` (신규. 메모리 `definer-storage-and-best-effort`: 적용된 마이그레이션 `20260702120000_app_config.sql`은 **수정 금지**, 신규 파일로.)

```sql
-- 20260722120000_app_config_store_url_ios.sql
-- app-version-gate 후속(app-update-actions): iOS 출시(2026-07)에 맞춰 store_url_ios 실값 반영.
--   선행 시드(20260702120000)는 store_url_ios=null(미출시)이라 권유 모달이 스토어로 못 감 → 실 URL로 채운다.
--   행은 선행 시드로 이미 존재(id=1) → UPSERT의 do-update 경로만 탐(min/latest/android 보존).
--   Android는 미출시 → store_url_android는 건드리지 않는다(null 유지, 출시 시 별도 UPDATE).
insert into public.app_config (id, store_url_ios, updated_at)
values (1, 'https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594', now())
on conflict (id) do update
  set store_url_ios = excluded.store_url_ios,
      updated_at = now();
```

- **UPSERT 근거:** 행은 선행 시드로 존재하므로 실무상 `do update` 경로만 탄다. 만약 행이 없어도(방어) insert되며 `min/latest`는 null(fail-open) — 무해. 순수 UPDATE 대신 UPSERT로 "행 부재 시 no-op" 리스크를 제거한다.
- **id6782955594** = 리더 확정 App Store ID. URL의 `%EB%A8%B9%EB%A1%9C%EA%B7%B8`는 "먹로그" percent-encoding — 그대로 유지(디코드/수정 금지).
- **미변경 보장:** `min_supported_version`·`latest_version`·`store_url_android` 미언급 → 보존. 이 마이그레이션은 게이트를 **활성화하지 않는다**(dormant 유지, §0).

### 3.2 설정용 판정 훅 `useAppUpdateStatus` (신규 — 생산자 3종 재사용)

```ts
// src/features/appVersion/useAppUpdateStatus/useAppUpdateStatus.ts
/** 설정 화면 업데이트 상태(판별 유니온). suggest-dismissal을 참조하지 않는다(설정 액션은 항상 노출). */
export type AppUpdateStatus =
  | { kind: 'checking' }                              // 조회 중 — 버전만 표시
  | { kind: 'available'; storeUrl: string | null }    // 최신 아님(force 또는 suggest) → 업데이트 액션
  | { kind: 'latest' }                                // 최신(ok)
  | { kind: 'unknown' };                              // 조회실패/형불량/current null → 버전만(fail-open)

/** 마운트 1회 app_config 조회 + 현재 버전 비교로 설정 업데이트 상태를 낸다. 폴링 0. */
export const useAppUpdateStatus: () => { status: AppUpdateStatus };
```

- **마운트 1회:** `fetchAppConfig()` → `getCurrentAppVersion()` → `resolveVersionGate({ current, minSupported, latest })` → 매핑. `storeUrl = Platform.OS === 'ios' ? config.storeUrlIos : config.storeUrlAndroid`.
- **`VersionGateDecision` → `AppUpdateStatus` 매핑:**
  - `Force` → `{ kind:'available', storeUrl }` (설정에선 force/suggest 모두 "업데이트 가능"으로 접음 — 게이트 차단은 별개 경로)
  - `Suggest` → `{ kind:'available', storeUrl }`
  - `Ok` → `{ kind:'latest' }`
  - `Unknown` → `{ kind:'unknown' }`
  - `fetchAppConfig()` null → `{ kind:'unknown' }` (fail-open)
- **`useAppVersionGate` 재사용 안 하는 이유(계약 결정):** `useAppVersionGate`는 suggest에 **dismissal**을 적용해 "나중에" 누른 버전을 `none`으로 감춘다. 설정 액션은 **dismiss와 무관하게 항상 동작해야 한다**(리더 요구) → dismissal을 참조하지 않는 별도 훅이 정확하다. `resolveVersionGate`·`fetchAppConfig`·`getCurrentAppVersion`은 그대로 재사용(중복 로직 0).
- **언마운트 가드:** `mountedRef`로 async 완료 후 setState 보호(`useAppVersionGate.ts:31` 패턴 동일).
- **폴링/Realtime 0.** effect deps `[]`, 명명 함수(`evaluateUpdateStatusOnMount`) — 컨벤션.

### 3.3 `AppVersionRow` props 확장 (표시 → 상태별 렌더)

```ts
// src/features/appVersion/AppVersionRow/AppVersionRow.tsx
export type AppVersionRowProps = {
  /** 표시할 앱 버전(예: "1.2.0"). ProfileScreen이 getCurrentAppVersion 값 주입. */
  version: string;
  /** 업데이트 상태 — 렌더 분기. ProfileScreen이 useAppUpdateStatus에서 주입. */
  status: AppUpdateStatus;
  /** "업데이트하기" 탭 콜백 — 스토어 Linking 배선은 ProfileScreen(expo-linking). */
  onUpdatePress: () => void;
};
```

**렌더 로직 계약(문구·비주얼 톤은 ui-publisher 소관, 아래는 로직 분기만):**

| status | 스토어URL | 렌더 | 액션(role=button) |
|--------|-----------|------|-------------------|
| `checking` | — | 버전 텍스트만 | 없음 |
| `available` | 있음 | 버전 + **업데이트 액션**(accent) | 있음 → `onUpdatePress` |
| `available` | null | 버전 텍스트만(열 스토어 없음 — Android 미출시 엣지) | 없음 |
| `latest` | — | 버전 + **최신 상태** 라벨(passive) | 없음 |
| `unknown` | — | 버전 텍스트만(fail-open, 상태 주장 안 함) | 없음 |

- **접근성:** 업데이트 액션은 `accessibilityRole="button"` + `testID="app-version-update"`. 테스트는 role/testID 기준(정확 문구는 ui-spec 확정 후).
- **후방호환:** 기존 `<AppVersionRow version=.../>` 소비처(ProfileScreen 1곳)는 새 props 추가로 갱신. 기존 spec 3건 갱신 필요(회귀).

### 3.4 ProfileScreen 배선

```ts
// src/navigation/screens/ProfileScreen/ProfileScreen.tsx
const appVersion = getCurrentAppVersion();          // 기존(line 205) 유지
const { status } = useAppUpdateStatus();            // 신규
const openStore = ({ storeUrl }: { storeUrl: string | null }) => {
  if (!storeUrl) return;
  void Linking.openURL(storeUrl);                   // expo-linking(AppVersionGate.tsx:22-25 동일 패턴)
};
// ...
{appVersion ? (
  <AppVersionRow
    version={appVersion}
    status={status}
    onUpdatePress={() => { if (status.kind === 'available') openStore({ storeUrl: status.storeUrl }); }}
  />
) : null}
```

- `appVersion` null이면 행 미렌더(기존 가드 유지). `expo-linking` top-level import 허용(네이티브 모듈 아님).

---

## 4. 화면 · UX (역할 경계)

- **AppVersionRow 업데이트 액션**(ui-publisher — 킷 비종속 보조 UI): 회원탈퇴 아래 약톤 행. `available` 시 "앱 버전 1.2.0" 옆/아래에 **업데이트 액션**(accent 텍스트/pressable, 예 "업데이트하기") 노출, 탭 → 스토어. `latest` 시 최신 상태(예 "최신 버전이에요", fgMuted/success 톤). 정확한 문구·배치·pressable 스타일은 ui-publisher가 킷 톤(caption·accentStrong·해요체)으로 ui-spec에 확정. developer는 비주얼 임의 변경 금지.
- **UpdateSuggestModal**: 코드 변경 없음. DB URL 반영 후 자동으로 2버튼(나중에│업데이트)이 렌더되고 "업데이트"→Linking이 동작한다(결함 1 해소 — 마이그레이션만으로).
- **상태:** `checking`(조회 중 — 버전만, 스피너 없음) → 판정 완료 시 액션/최신 라벨 나타남(짧은 지연 허용, fail-open). 실패 → 버전만.

---

## 5. 작업 목록 (각 인수조건 포함, 소유자 태그)

### DB (developer / qa-logic)
- [ ] **T1. [dev] iOS 스토어 URL 마이그레이션** `20260722120000_app_config_store_url_ios.sql` — 인수조건: id=1 UPSERT로 `store_url_ios`에 확정 URL(`id6782955594` 포함) 설정, `updated_at` 갱신, `store_url_android`·`min_supported_version`·`latest_version` **미변경**. 신규 파일(선행 마이그레이션 수정 0). — 테스트(T1-spec): SQL 문자열 계약(`appConfigMigration.spec.ts` 패턴) — URL/`on conflict (id)`/`updated_at` 포함, android·min·latest 미포함.

### 설정 판정 훅 (developer / qa-logic)
- [ ] **T2. [dev] `useAppUpdateStatus` 훅** — 인수조건: 마운트 1회 `fetchAppConfig`+`getCurrentAppVersion`+`resolveVersionGate` → force/suggest=`available`(+플랫폼 storeUrl), ok=`latest`, unknown/fetch null/current null=`unknown`. dismissal 미참조. 폴링 0(fetch 1회). — 테스트: `fetchAppConfig`·`currentAppVersion`·`Platform` 모킹 — 5매핑 + storeUrl 플랫폼(ios→Ios/android→Android) + available&storeUrl null + fetch 1회 단언.

### 설정 UI·배선 (ui-publisher ∥ developer / qa-visual ∥ qa-logic)
- [ ] **T3. [ui/dev] `AppVersionRow` 상태별 렌더** — 인수조건(§3.3 표): checking/unknown→버전만·액션 없음, available+storeUrl→업데이트 액션(role button)+`onUpdatePress`, available+storeUrl null→버전만, latest→최신 라벨·액션 없음. — 테스트: `renderWithTheme` — status별 `queryByRole('button')`/`onUpdatePress` 호출/버전 텍스트. (문구는 ui-spec 후 fill, 테스트는 testID/role 우선.)
- [ ] **T4. [dev] ProfileScreen 배선** — 인수조건: `useAppUpdateStatus` 소비, `openStore`(expo-linking, storeUrl null no-op), `AppVersionRow`에 version/status/onUpdatePress 주입, appVersion null이면 행 미렌더. available 액션 탭 → `Linking.openURL(storeUrl)` 1회. — 테스트: `useAppUpdateStatus`·`Linking` 모킹 — available 탭 시 openURL(URL) 호출·storeUrl null no-op·행 렌더 유무.

### 회귀
- [ ] **T5. [dev] 회귀 0** — 인수조건: `npm test` 전체 green + `tsc --noEmit` 0 에러. 기존 `AppVersionRow.spec.tsx` 3건은 새 props로 갱신, `useAppVersionGate`·`UpdateSuggestModal`·`AppVersionGate`·ProfileScreen 기타 동작 무변경. — 테스트: 기존 spec 통과(갱신분 포함).

> 순서: T1(DB·독립) ∥ T2(훅) → T3(UI, ui-publisher 문구 확정과 병렬) → T4(배선, T2·T3 의존) → T5.

## 5-1. 테스트 케이스 (TDD, jest-expo + @testing-library/react-native)

- **T1 마이그레이션 SQL 계약**: 파일 존재 / `on conflict (id) do update` / `store_url_ios` + `id6782955594` 포함 / `updated_at` 갱신 / `store_url_android` **미포함** / `min_supported_version`·`latest_version` **미포함**.
- **T2 `useAppUpdateStatus`**: (a) suggest(current 1.0.0 < latest 1.2.0) → available+storeUrl ios. (b) force(current < min) → available. (c) ok(current 1.2.0 ≥ latest 1.0.0) → latest. (d) fetch null → unknown. (e) current null → unknown. (f) 형불량(latest "x") → unknown. (g) Platform android → storeUrlAndroid. (h) available & storeUrl null(android 미출시). (i) fetchAppConfig 1회(폴링 0).
- **T3 `AppVersionRow`**: checking→버튼 없음·버전만 / available+storeUrl→버튼 있음·press→onUpdatePress 1회 / available+storeUrl null→버튼 없음 / latest→버튼 없음·최신 라벨 / unknown→버튼 없음. 기존 "앱 버전 {v}" 렌더 유지(회귀).
- **T4 ProfileScreen 배선**: available 액션 탭→`Linking.openURL('https://apps.apple.com/...id6782955594')` 1회 / storeUrl null→openURL 미호출 / appVersion null→행 미렌더.

**모킹/스모크(단위 불가)**:
- 실 `app_config` UPDATE 반영·iOS 스토어 실제 이동 → **라이브/디바이스 스모크**(마이그레이션 적용 후, §9).
- 권유 모달 2버튼 렌더 확인 → 운영자가 `latest_version`을 임시 상향하거나 낮은 `current` 빌드로 디바이스 스모크.

---

## 6. 엣지케이스

- **config 조회 실패(네트워크·RLS·타임아웃)**: `fetchAppConfig` null → status `unknown` → 설정 행은 **버전만**(업데이트 액션·최신 주장 없음). fail-open — 앱 정상.
- **storeUrl null(Android 미출시)**: status `available`이어도 열 스토어 없음 → 액션 **미노출**(버전만). iOS는 URL 있어 정상 노출. `openStore`도 null no-op 이중 방어.
- **현재 버전 미확보(`expo-constants` null)**: current null → `resolveVersionGate` unknown → status unknown, 그리고 `appVersion` null이면 행 자체 미렌더(기존 가드).
- **최신 상태(ok, 현재 1.2.0 ≥ latest 1.0.0)**: status `latest` → "최신 버전이에요" passive. **현재 배포 상태의 기본 표시**(§0 — URL만 채운 직후).
- **suggest dismiss와의 관계(핵심)**: `useAppUpdateStatus`는 dismissal을 **참조하지 않는다** → 사용자가 권유 모달을 "나중에"로 닫았어도 설정 행은 항상 "업데이트하기"를 노출한다(리더 요구 충족). 게이트 모달(`useAppVersionGate`)의 dismissal과 독립.
- **결함 1 재현·해소 경로**: URL null → 모달 단일 "확인"(현 버그) → 마이그레이션으로 `store_url_ios` 채움 → 모달 2버튼 + "업데이트"→Linking 정상(코드 무변경).
- **마이그레이션 행 부재(방어)**: UPSERT라 insert되며 min/latest null(fail-open) — 무해. 실무상 선행 시드로 행 존재 → do-update만.
- **커플 동시성**: 버전/업데이트 판정은 각 기기 클라 로컬(공유 데이터·쓰기 0) → 동시성 영향 0.
- **탭 재방문**: React Navigation 탭은 첫 포커스 후 마운트 유지(unmountOnBlur false) → 세션당 fetch 1회. 매 탭 전환 재조회 아님.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

**qa-logic(로직·통합)**:
- **결함 1 end-to-end**: 마이그레이션 UPSERT(`store_url_ios`) ↔ `app_config.store_url_ios` ↔ `fetchAppConfig`(`storeUrlIos`) ↔ `UpdateSuggestModal`(storeUrl 있으면 2버튼) ↔ `AppVersionGate.openStore`(Linking). URL 반영 시 2버튼·스토어 이동 성립.
- **useAppUpdateStatus 매핑** ↔ `resolveVersionGate` 재사용(force/suggest→available, ok→latest, unknown/null→unknown) + **dismissal 미참조** 확인.
- **AppVersionRow 렌더 분기(§3.3 표)** ↔ ProfileScreen 배선(`openStore`·Platform storeUrl·null no-op·appVersion null 가드).
- **마이그레이션 미변경 보장**: android·min·latest 미변경(게이트 비활성 유지).
- **비용**: ProfileScreen 마운트 1회 fetch·폴링/Realtime 0·AWS 0·Edge 0.

**qa-visual(비주얼 충실도)**:
- `AppVersionRow` 업데이트 액션(accent·pressable)·최신 라벨 톤이 킷 보조텍스트 톤(caption·accentStrong·해요체)과 정합. 회원탈퇴 행 대비 위계.
- ProfileScreen 하단 레이아웃 회귀 0(액션 추가 외).
- 디바이스 스모크: available 시 업데이트 액션 탭 → iOS 스토어(먹로그 페이지) 이동.

---

## 8. 비용 가드레일 체크

- **AWS 미사용** — Supabase 단일행 select만. Edge Function 0.
- **ProfileScreen app_config 조회 = 마운트 1회** — 탭 캐시로 세션당 사실상 1회, 폴링/Realtime 0(§6 원칙 정합). 재판정=앱 재시작.
- **게이트 fetch와 dedup 안 함(의식적)** — 콜드스타트 게이트 1회 + Profile 진입 1회 = 세션당 최대 2회 1행 select. 비용 무시 가능 → 공유 캐시/컨텍스트(결합도↑)보다 단순성 우선.
- **신규 네이티브 0** — 기존 `expo-constants`·`expo-linking`만 사용(재빌드 불필요).
- **이미지·Kakao·viewport** — 본 기능 무관.

---

## 9. 산출물 / 완료 기준 / 라이브 절차

- **신규**: `supabase/migrations/20260722120000_app_config_store_url_ios.sql` + SQL 계약 spec / `src/features/appVersion/useAppUpdateStatus/`(훅 + spec) / `AppVersionRow` props 확장 + spec 갱신.
- **수정**: `ProfileScreen.tsx`(useAppUpdateStatus·openStore·AppVersionRow 주입) / `src/features/appVersion/index.ts`(useAppUpdateStatus·AppUpdateStatus export) / `AppVersionRow` export 시그니처.
- **완료 기준**: T1~T5 green + `npm test` 전체 통과 + `tsc --noEmit` 0 + ui-spec(설정 액션 문구·톤)·dev-notes + qa-report-logic·qa-report-visual 병렬 통과.
- **프로덕션 적용 절차(사용자 전담 — 운영자 작업)**:
  1. 마이그레이션 배포: `supabase db push`로 `20260722120000_app_config_store_url_ios.sql` 적용(행은 dormant 시드로 존재 → do-update로 `store_url_ios`만 갱신).
     - 대안: Supabase SQL 에디터에서 동일 UPSERT 직접 실행(§ architecture line 282 운영 절차 정합 — 값은 SQL/대시보드로 갱신).
  2. 검증: iOS 빌드에서 (a) 설정 행 = "최신 버전이에요"(현재 1.2.0 ≥ latest 1.0.0), (b) 권유 모달 2버튼·스토어 이동은 운영자가 `latest_version`을 임시 상향(예 1.3.0)하거나 낮은 current 빌드로 디바이스 스모크.
  3. **다음 릴리스 배포 순서(§ architecture line 282)**: 새 빌드 심사 통과 → `latest_version` 상향(권유 모달·설정 액션 활성, 비차단) → 충분한 유예 후에만 `min_supported_version` 상향(강제 차단).
- **architecture 변경 이력 추가**: `app-update-actions`(store_url_ios 실값 `id6782955594` 반영 + 설정 업데이트 액션 `useAppUpdateStatus`·`AppVersionRow` 확장). §5 백로그 `app-version-gate` 행에 후속 스프린트 링크 부기(developer/문서 담당).
