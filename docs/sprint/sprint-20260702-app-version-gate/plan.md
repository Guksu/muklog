# Sprint: 앱 버전 확인·업데이트 안내 (app-version-gate)

> 작성 단일 출처: `docs/design/architecture.md`(§1 결정·§3 데이터 모델·§4 네비게이션·§6 비용 가드레일) · 현재 코드(App.tsx·AuthGate·ProfileScreen·RenameDialog) · 킷 비종속 신설 UI 선례(room-lifecycle 배너·회원탈퇴 시트).
> 풀 파이프라인: **planner → ui-publisher → developer → qa(qa-visual ∥ qa-logic)**. UI 신설 O(차단 화면·권유 모달·버전 행).
> git 작업 없음. TDD(인수조건 = 테스트 케이스, Red 먼저). 비용 가드레일 최우선(AWS 0·폴링 0·진입 1회 조회).

---

## 0. 배경 — 문제 (사용자 요청)

앱이 ① 버전을 어디에도 노출하지 않고 ② 원격 버전 체크가 없어, 출시 후 **강제 업데이트/업데이트 권유 수단이 전무**하다. 3요소를 하나의 "버전 게이트" 기능으로 묶는다: (a) Profile 버전 표시 (b) 원격 버전 확인 인프라 (c) 게이트 분기(강제 차단 / 권유 모달 / fail-open).

> **분할 판단**: 본 스프린트는 5개 로직 모듈 + 마이그레이션 1 + 신설 UI 2 + 버전 행 1로 상한급이나, 각 단위가 작고 권유 모달이 RenameDialog 셸 패턴을 재사용하므로 **1스프린트 실행 가능**으로 판단. 실행 중 과부하 시 **fallback 절단선 = 슬라이스A(인프라 + 버전 표시 + 게이트 *판정*, T1~T7·T12) / 슬라이스B(차단·권유 UI, T8~T11)**. 작업 순서를 A→B로 배치해 A가 먼저 완결되게 한다(§5).

---

## 1. 기능 한줄 정의

앱 콜드스타트 시 원격 `app_config`를 **1회 조회**해 현재 버전과 비교하여: 지원 최소 미만이면 **닫을 수 없는 강제 업데이트 화면**으로 차단하고, 최소 이상·최신 미만이면 **닫을 수 있는 업데이트 권유 모달**을 (버전당 1회) 띄우며, 조회 실패·형불량이면 **아무것도 막지 않는다(fail-open)**. 사용자는 Profile에서 현재 앱 버전을 확인할 수 있다.

---

## 2. 범위

### In-scope
- **(a) Profile 버전 표시** — 현재 앱 버전(app.json `version`, `expo-constants`)을 ProfileScreen에 표시.
- **(b) 원격 버전 확인 인프라** — `app_config` 단일행 테이블(마이그레이션 신규) + 콜드스타트 1회 조회(폴링/Realtime 0).
- **(c) 게이트 분기** — semver 비교 순수 유틸 + 판정(force/suggest/ok/unknown) + **강제 차단 화면**(닫기 불가·스토어 이동) / **권유 모달**(닫기 가능·노출 정책) / **fail-open**(실패·형불량·빈 config는 미차단).
- 신규 모듈: `compareVersion`·`resolveVersionGate`(순수)·`fetchAppConfig`(supabase 래퍼)·`updateSuggestDismissal`(AsyncStorage)·`useAppVersionGate`(훅)·`AppVersionGate`(래퍼)·`ForceUpdateScreen`·`UpdateSuggestModal`(UI).

### Out-of-scope (일부러 안 함)
- **expo-application**(네이티브 모듈) — 신규 네이티브 도입 지양(재빌드+미탑재 크래시 리스크, 메모리 `native-module-lazy-require`). 현재 버전은 **expo-constants(JS-only, 재빌드 불필요)** 로만 취득.
- **스토어 인앱 업데이트 API**(Android In-App Updates·iOS) — 단순 스토어 링크(Linking)만.
- **강제 업데이트 후 자동 재조회/폴링** — 콜드스타트 1회만(재확인은 앱 재시작).
- **원격 config 쓰기 UI** — 값은 운영자가 SQL/대시보드로 설정(앱은 읽기 전용).
- 버전 롤아웃 퍼센티지·A/B·기능 플래그·서버 점검 배너 — 별개 후속.

---

## 3. 데이터 · API 계약

### 3.1 신규 테이블 `app_config` (마이그레이션 `supabase/migrations/20260702120000_app_config.sql`)

```sql
create table if not exists public.app_config (
  id                     int primary key default 1 check (id = 1),   -- 싱글턴(1행 보장)
  min_supported_version  text,        -- semver "x.y.z"(nullable → fail-open)
  latest_version         text,        -- semver "x.y.z"(nullable → suggest 미발화)
  store_url_ios          text,        -- 미출시=null(버튼 숨김)
  store_url_android      text,        -- 미출시=null
  updated_at             timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- 공개 비민감 설정 → 읽기는 anon+authenticated 모두 허용(로그인 전 게이트 필요, §4.1).
create policy app_config_read on public.app_config for select to anon, authenticated using (true);
-- insert/update/delete 정책 없음 → 운영자(service role/SQL 에디터)만 변경. 앱은 읽기 전용.

-- 시드: 게이트 dormant 기본값(전원 미차단·미권유). 운영자가 출시 후 값 갱신.
insert into public.app_config (id, min_supported_version, latest_version)
  values (1, '0.0.0', '1.0.0')
  on conflict (id) do nothing;
```

- **RLS 근거**: min/latest/store URL은 민감정보 아님(사용자 데이터 무관) → anon 읽기 허용해 **로그인 전에도 게이트 판정 가능**(§4.1). insert/update/delete는 정책 부재로 anon·authenticated 모두 불가(운영자 service role만).
- **시드 근거(§planner 5, 강제 게이트 남용 방지)**: min=`0.0.0`(아무도 미달 불가 → 전원 미차단), latest=`1.0.0`(현재와 동일 → 권유 미발화). 게이트는 **dormant로 시작**, 운영자가 값을 올릴 때만 활성. min 오설정=전원 차단 위험 → 값 검증(형불량 fail-open, §3.3) + 운영 절차를 architecture 변경 이력에 기록.

### 3.2 조회 래퍼 `fetchAppConfig` (supabase 직접 select — Edge Function 불필요)

```ts
// src/features/appVersion/fetchAppConfig/fetchAppConfig.ts
import { supabase } from '@/lib/supabase';
export type AppConfig = {
  minSupportedVersion: string | null;
  latestVersion: string | null;
  storeUrlIos: string | null;
  storeUrlAndroid: string | null;
};
/** app_config 1행 조회. 에러/빈/형불량은 null(=fail-open, 호출부가 게이트 미발화). throw 금지. */
export const fetchAppConfig = (): Promise<AppConfig | null>;
```
- `supabase.from('app_config').select('min_supported_version, latest_version, store_url_ios, store_url_android').eq('id', 1).maybeSingle()` → snake→camel 매핑. **error/데이터 없음/예외 → null**(조용히). 네트워크 0 추가(1회 select).

### 3.3 semver 비교 순수 유틸 `compareVersion` (설계 포인트 1)

```ts
// src/features/appVersion/compareVersion/compareVersion.ts
/**
 * semver 3자리("x.y.z") 수치 비교. major→minor→patch 순.
 * 결측/형불량(비"x.y.z"·NaN·음수)은 null(비교 불가 → 호출부 fail-open).
 * @returns -1(a<b) | 0(a==b) | 1(a>b) | null(비교 불가)
 */
export const compareVersion = ({ a, b }: { a: string; b: string }): -1 | 0 | 1 | null;
```
- **빌드번호 제외**: 스토어 표기 축인 3자리 semver(`version`)만 비교. iOS buildNumber/Android versionCode(내부 축)는 게이팅에 미사용(근거: min/latest도 semver로 운영).
- 파싱: `/^\d+\.\d+\.\d+$/` 통과 시 정수 3튜플 비교, 아니면 null.

### 3.4 게이트 판정 순수 유틸 `resolveVersionGate`

```ts
// src/features/appVersion/resolveVersionGate/resolveVersionGate.ts
export const VersionGateDecision = {
  Force: 'force',     // current < minSupported → 차단
  Suggest: 'suggest', // minSupported <= current < latest → 권유
  Ok: 'ok',           // current >= latest
  Unknown: 'unknown', // 비교 불가(결측/형불량) → fail-open
} as const;
export type VersionGateDecision = (typeof VersionGateDecision)[keyof typeof VersionGateDecision];
/**
 * @returns force/suggest/ok/unknown. 어느 비교라도 null이면 unknown(fail-open).
 */
export const resolveVersionGate = ({
  current, minSupported, latest,
}: { current: string | null; minSupported: string | null; latest: string | null }): VersionGateDecision;
```
- 규칙: current 결측 → unknown. `compareVersion(current, minSupported) === -1` → force. `min<=current` && `compareVersion(current, latest) === -1` → suggest. 그 외 ok. 비교 결과가 필요한데 null → unknown.

### 3.5 권유 노출 정책 저장 `updateSuggestDismissal` (설계 포인트 3, AsyncStorage — notifPrefs·pendingPick 선례)

```ts
// src/features/appVersion/updateSuggestDismissal/updateSuggestDismissal.ts
export const UPDATE_SUGGEST_DISMISSED_KEY = 'muklog:update-suggest-dismissed';
/** 사용자가 마지막으로 "나중에" 누른 latest_version(없으면 null). 파싱실패 null. */
export const loadDismissedVersion = (): Promise<string | null>;
/** 권유 모달 "나중에" 시 현재 latest_version 기록(그 버전은 재노출 안 함). */
export const saveDismissedVersion = ({ version }: { version: string }): Promise<void>;
```
- **정책 = 버전당 1회**(매 콜드스타트/세션당 아님 — 과노출 최소). `latest_version`을 키로 기록: 저장값 === 현재 latest면 미노출, 더 새 latest면 재노출. 강제(force)는 dismissal 무시(항상 차단).

### 3.6 게이트 훅 `useAppVersionGate`

```ts
// src/features/appVersion/useAppVersionGate/useAppVersionGate.ts
export type VersionGateState =
  | { status: 'checking' }                                   // 조회 중(자식 정상 렌더 — fail-open)
  | { status: 'force'; storeUrl: string | null }             // 차단
  | { status: 'suggest'; latestVersion: string; storeUrl: string | null } // 권유(미dismiss)
  | { status: 'none' };                                      // ok/unknown/dismiss됨 → 자식만
export const useAppVersionGate: () => { state: VersionGateState; dismissSuggest: () => void };
```
- 마운트 1회: `fetchAppConfig()` → `resolveVersionGate({ current: Constants.expoConfig?.version ?? null, min, latest })`.
  - force → `{status:'force', storeUrl: platformStoreUrl}`.
  - suggest → `loadDismissedVersion()` 비교: 이미 dismiss(=== latest)면 `none`, 아니면 `{status:'suggest', latestVersion, storeUrl}`.
  - ok/unknown/fetch null/current null → `none`(**fail-open**).
- `platformStoreUrl` = `Platform.OS === 'ios' ? storeUrlIos : storeUrlAndroid`(null 가능 → 버튼 숨김).
- `dismissSuggest()` → `saveDismissedVersion({version: latestVersion})` + state `none`.
- **폴링/Realtime 0**, 1회 조회만(비용 가드레일 §8).

### 3.7 현재 버전 취득 (expo-constants, 설계 포인트 out)
- `expo-constants` **직접 의존성 추가**(`npx expo install expo-constants`, JS-only → 재빌드 불필요). `Constants.expoConfig?.version`(app.json `version` "1.0.0"). null이면 current=null → unknown(fail-open).
- top-level import 허용(네이티브 모듈 아님 → lazy-require 불요). expo-application 미도입(§2 OUT).

---

## 4. 화면 · UX (역할 경계)

### 4.1 게이트 위치 (설계 포인트 2) — **AuthGate 상위(인증 무관 최상위)**

| 위치 | 장점 | 단점 | 판정 |
|------|------|------|------|
| **AuthGate 상위(App.tsx `<AuthGate/>` 래핑)** ⭐ | 로그인 전(Splash/Login)에도 강제 차단 노출. 콜드스타트 1회 조회가 auth와 독립·병렬(로그인 마찰 전 차단). | config를 anon 읽기 RLS로 열어야 함(비민감이라 무해). | **채택** |
| authenticated 후 | RLS를 authenticated 전용으로 단순화. | 로그인 화면 사용자는 게이트 우회(강제 미달자가 로그인까지 시도). | 기각 |

- **배치**: `App.tsx`의 `<AuthGate />`를 `<AppVersionGate><AuthGate /></AppVersionGate>`로 래핑(ThemeProvider/ToastProvider 안쪽 → 토큰·토스트 사용 가능, AuthProvider와 독립).
- **fail-open 렌더 규칙**: `checking`·`none` → **자식(AuthGate) 그대로 렌더**(조회 대기가 콜드스타트/첫 페인트를 막지 않음 — 성능·fail-open). `force` → 자식 대신 `ForceUpdateScreen`. `suggest` → 자식 + `UpdateSuggestModal` 오버레이. (force가 조회 후 늦게 확정되면 잠깐 자식 노출 후 차단 — 미달 버전만 해당, 허용.)

### 4.2 신설 UI (ui-publisher — 킷 비종속, 프리미티브·킷 톤 정합)
- **`ForceUpdateScreen`**(전체 차단): `Screen center` + 중앙 콘텐츠(아이콘/이모지 + 제목 "업데이트가 필요해요" + 본문 해요체 + primary `Button` "업데이트하러 가기"→`Linking.openURL(storeUrl)`). **닫기·뒤로가기 불가**(네비게이션 없음, Android 하드웨어백 no-op). storeUrl null이면 **버튼 숨김 + 안내문**("스토어에서 최신 버전으로 업데이트해 주세요"). 브랜드 코럴·헤어라인·해요체.
- **`UpdateSuggestModal`**(닫기 가능 권유): **RenameDialog 셸 패턴 재사용**(Modal + 딤 backdrop + 중앙 카드 + 상단 hairline 2버튼 행). 입력 없음 — 제목 "새 버전이 나왔어요" + 본문 + "나중에"(→dismissSuggest) │ "업데이트"(→Linking, storeUrl null이면 버튼 숨김/1버튼). ui-publisher가 RenameDialog 비주얼 토큰을 참조해 입력 없는 확인형으로 제안(ConfirmDialog 프리미티브 일반화 여부는 ui-publisher 재량, ui-spec 기록).
- **Profile 버전 행**(경미 UI): ProfileScreen 하단(설정 카드 아래·회원탈퇴 근처)에 현재 버전 표시. 권장: 비-pressable `caption/fgMuted` "앱 버전 1.0.0"(킷 비종속 보조 텍스트). ui-publisher가 배치/스타일 확정, developer가 버전 값 배선.

### 4.3 상태 (로딩/성공/에러)
- `checking`: UI 없음(자식 정상). 별도 스피너 없음(fail-open — 지연 체감 0).
- `force`: 전체 차단(복구 불가·앱 진행 차단). 유일하게 자식을 대체.
- `suggest`: 권유 모달(비차단, 닫기 가능).
- `none`: 무변화.
- 조회 실패: `none`(사용자에게 아무 표시 없음 — 앱 정상 사용).

### 4.4 원티드 토큰
- ForceUpdateScreen·UpdateSuggestModal·버전 행 모두 `theme` 토큰만(raw hex 0). 코럴 브랜드·헤어라인·radius·해요체 카피(ui-publisher ui-spec).

---

## 5. 작업 목록 (각 인수조건 포함, 소유자 태그)

### 인프라·판정 (developer / qa-logic) — 슬라이스 A
- [ ] **T1. [dev] `app_config` 마이그레이션** — 인수조건: 싱글턴 테이블(id=1 check)·RLS enable·anon+authenticated select 정책·insert/update/delete 정책 부재·dormant 시드(min 0.0.0·latest 1.0.0). additive 신규 파일. — 테스트: SQL 문자열 계약 검사(정책·grant·check·시드 존재, 기존 마이그레이션 spec 패턴).
- [ ] **T2. [dev] `compareVersion` 순수 유틸** — 인수조건: a<b/==/> → -1/0/1, 형불량·결측 → null. — 테스트: 정상 3분기·경계(1.0.0 vs 1.0.1·1.10.0 vs 1.9.0)·실패(빈·"1.0"·"a.b.c"·null → null).
- [ ] **T3. [dev] `resolveVersionGate` 순수 유틸** — 인수조건: force(current<min)/suggest(min<=current<latest)/ok(>=latest)/unknown(어느 비교라도 null). — 테스트: 4분기 + current null·min null·latest null 각 unknown/적정.
- [ ] **T4. [dev] `fetchAppConfig` 조회 래퍼** — 인수조건: 1행 조회 snake→camel, error/빈/예외 → null(throw 0). — 테스트: supabase 모킹 — 정상 매핑·error→null·empty→null.
- [ ] **T5. [dev] `updateSuggestDismissal` (AsyncStorage)** — 인수조건: save→load 왕복(버전 문자열), 미저장·파싱실패 → null. — 테스트: AsyncStorage 모킹 왕복·폴백.
- [ ] **T6. [dev] `useAppVersionGate` 훅** — 인수조건: 마운트 1회 fetch+판정 → force/suggest(미dismiss)/none. suggest인데 dismiss(=== latest)면 none. fetch null/current null/ok/unknown → none(fail-open). storeUrl=플랫폼 분기. dismissSuggest→저장+none. 폴링 0. — 테스트: fetchAppConfig·Constants·dismissal 모킹 — 각 분기, fail-open, dismiss 경로, storeUrl 플랫폼.
- [ ] **T7. [dev] `AppVersionGate` 래퍼 + App.tsx 배선** — 인수조건: checking/none→자식 렌더, force→ForceUpdateScreen(자식 대체), suggest→자식+모달. App.tsx가 `<AuthGate/>`를 래핑. — 테스트: 상태별 렌더 분기(자식 존재/부재), App 트리 배선.

### 신설 UI (ui-publisher / qa-visual) — 슬라이스 B
- [ ] **T8. [ui] `ForceUpdateScreen`** — 인수조건: 전체화면 차단(닫기·뒤로 불가), 제목/본문 해요체, storeUrl 있으면 primary Button→Linking, 없으면 버튼 숨김+안내문. 코럴·헤어라인·토큰만. — 검증: 킷 톤 정합(qa-visual), Linking 호출(qa-logic), 디바이스 스모크(하드웨어백 no-op).
- [ ] **T9. [ui] `UpdateSuggestModal`** — 인수조건: RenameDialog 셸 패턴(딤·중앙카드·2버튼 행) 재사용, 입력 없음, "나중에"/"업데이트"(storeUrl null이면 업데이트 숨김), 딤/나중에→dismiss. — 검증: RenameDialog 비주얼 정합(qa-visual), 콜백 배선(qa-logic).
- [ ] **T10. [ui] Profile 버전 행** — 인수조건: ProfileScreen에 현재 버전(expo-constants) 표시, 토큰 스타일. — 검증: 버전 값 렌더(qa-logic), 배치/톤(qa-visual).
- [ ] **T11. [dev] Linking·플랫폼 스토어 URL 배선** — 인수조건: `Linking.openURL(storeUrl)`(expo-linking), Platform.OS로 ios/android URL 선택, null이면 버튼 미렌더(열기 시도 0). — 테스트: Linking 모킹 — 호출 URL·플랫폼 분기·null no-op.

### 회귀
- [ ] **T12. [dev] 회귀 0** — 인수조건: `npm test` 전체 green, AuthGate 5분기·App 프로바이더 트리·ProfileScreen 기존 동작 무변경(버전 행 추가 외). — 테스트: 기존 spec 무변경 통과.

> 순서(fallback 절단 대비): **슬라이스 A** T1→T2·T3(순수)→T4·T5→T6→T7 → **슬라이스 B** T8·T9·T10·T11(ui∥dev) → T12. A 완결 후 B 진입 → 과부하 시 B를 후속 스프린트로 분리 가능(리더 판단).

## 5-1. 테스트 케이스 (TDD)

**단위(jest-expo + @testing-library/react-native)**:
- `compareVersion`(T2): 정상·경계(자리 자릿수·두 자리 minor)·실패(형불량·결측) → null.
- `resolveVersionGate`(T3): force/suggest/ok/unknown 4분기 + 결측 3종.
- `fetchAppConfig`(T4): supabase 모킹 — 매핑·error null·empty null.
- `updateSuggestDismissal`(T5): 왕복·폴백.
- `useAppVersionGate`(T6): fetchAppConfig·`expo-constants`·dismissal 모킹 — 전 분기·fail-open(fetch null·current null·형불량)·dismiss 경로·storeUrl 플랫폼.
- `AppVersionGate`(T7): 상태별 자식 렌더/대체.
- `ForceUpdateScreen`·`UpdateSuggestModal`·Profile 버전 행(T8~T11): Linking 모킹 호출·storeUrl null 버튼 부재·dismiss 콜백·버전 텍스트.

**모킹/스모크(외부·네이티브 — 단위 불가)**:
- 실제 `app_config` RLS(anon 읽기 허용·쓰기 거부) → **라이브 스모크**(`supabase db push` 후, 메모리: RLS·권한은 라이브에서만 드러남).
- 실제 스토어 Linking·Android 하드웨어백 차단·expo-constants 버전 값 → **디바이스 스모크**.
- expo-constants 설치 후 실제 `Constants.expoConfig.version` 반환값(빌드별 차이) → 디바이스 스모크(fail-open이 미확보 커버).

---

## 6. 엣지케이스

- **조회 실패(네트워크·RLS·타임아웃)**: fetchAppConfig null → 게이트 none(**fail-open**, 앱 정상). 버전 체크 실패로 앱을 못 쓰는 일 없음(설계 원칙).
- **config 형불량/빈 값**(min/latest null·비semver): compareVersion null → unknown → none(미차단). 강제 게이트 오설정 안전판.
- **current 버전 미확보**(expo-constants null): current null → unknown → none(fail-open).
- **min_supported 오설정(과대)**: 운영 리스크 — 시드 기본 0.0.0 + 형불량 fail-open + 운영 절차(architecture 기록). 라이브 스모크에서 값 검증 후 반영.
- **강제 차단 중 스토어 URL 미설정**(미출시): 버튼 숨김 + 안내문만(차단은 유지). 출시 후 URL 채우면 버튼 노출.
- **권유 과노출**: 버전당 1회(dismissal 기록). 같은 latest 재콜드스타트 시 미노출, 새 latest면 재노출. 강제는 dismissal 무시.
- **로그인 전 강제 차단**: AuthGate 상위 배치 + anon 읽기 → Splash/Login 위에도 차단(로그인 마찰 전). 
- **force 늦은 확정**(조회가 첫 페인트보다 느림): checking 동안 자식 렌더 → force 확정 시 차단으로 전환(미달 버전만, 짧은 노출 허용 — fail-open·콜드스타트 우선).
- **커플 동시성**: 버전 게이트는 각 기기 클라 판정(공유 데이터 무관, 쓰기 0). 동시성 영향 0.
- **오프라인 콜드스타트**: fetch 실패 → fail-open(앱 사용 가능). 온라인 복귀 후 재시작 시 재판정.
- **anon이 config 쓰기 시도**: 정책 부재로 거부(읽기 전용). 운영자 service role만 변경.

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

**qa-logic(로직·통합)**:
- `app_config`(컬럼·RLS) ↔ `fetchAppConfig`(select 컬럼·snake→camel) ↔ `useAppVersionGate`(config 소비): 컬럼명·nullable·RLS anon 읽기 정합.
- `compareVersion`/`resolveVersionGate`(판정) ↔ `useAppVersionGate`(소비): 4분기·fail-open 경로.
- `updateSuggestDismissal`(버전당 1회) ↔ `useAppVersionGate`(dismiss 소비): 노출 정책.
- `useAppVersionGate` ↔ `AppVersionGate` ↔ `App.tsx`(AuthGate 래핑): 상태별 렌더·자식 대체.
- `expo-constants`(current) ↔ 판정: 미확보 fail-open.
- Linking·Platform ↔ storeUrl null: 열기 시도 0.
- 비용 가드레일: 1회 조회·폴링 0·anon 읽기만(쓰기 거부)·AWS 0.
- **보안**: app_config anon 읽기가 사용자 데이터 미노출(비민감 config만) 확인. 쓰기 정책 부재.

**qa-visual(비주얼 충실도)**:
- `ForceUpdateScreen`·`UpdateSuggestModal`(RenameDialog 셸 톤)·Profile 버전 행 ↔ 킷 톤(코럴·헤어라인·radius·해요체). 킷 비종속 신설이라 프리미티브(Screen/Button/RenameDialog 셸) 정합 기준.
- ProfileScreen 기존 레이아웃 회귀 0(버전 행 추가 외).
- 디바이스 스모크: 차단 화면 전체 덮음·모달 딤·버튼 상태.

## 8. 비용 가드레일 체크

- **AWS 미사용** — Supabase Postgres 단일행 테이블 1개. Edge Function 0(직접 select).
- **진입 1회 조회 / 폴링·Realtime 0** — 콜드스타트 1회 fetchAppConfig만. 재판정=앱 재시작.
- **anon 읽기 1행** — 무료 티어 내 극소 쿼리. 쓰기 없음.
- **신규 네이티브 0** — expo-constants(JS-only)만 추가, 재빌드 불필요. expo-application 미도입.
- **이미지·Kakao·viewport** — 본 기능 무관.

---

## 9. 산출물 / 완료 기준

- 신규 마이그레이션: `supabase/migrations/20260702120000_app_config.sql`.
- 신규 모듈: `src/features/appVersion/`(`compareVersion`·`resolveVersionGate`·`fetchAppConfig`·`updateSuggestDismissal`·`useAppVersionGate` + 각 spec) + `AppVersionGate`·`ForceUpdateScreen`·`UpdateSuggestModal`(UI).
- 수정: `App.tsx`(AuthGate 래핑), `ProfileScreen`(버전 행), `package.json`(expo-constants).
- 완료 기준: T1~T12 green + `npm test` 전체 통과 + ui-spec(신설 UI 근거)·dev-notes + qa-report-logic·qa-report-visual 병렬 통과.
- 라이브 검증(이월): `app_config` RLS(anon 읽기·쓰기 거부)는 `supabase db push` 후 스모크, 스토어 Linking·하드웨어백 차단·expo-constants 버전은 디바이스 스모크(메모리: RLS·네이티브는 라이브/디바이스에서만 드러남).
- **architecture 변경 이력 추가**(운영 절차): app_config 값 갱신은 SQL/대시보드, min_supported 상향 시 전 사용자 차단 주의(dormant 기본·형불량 fail-open).
