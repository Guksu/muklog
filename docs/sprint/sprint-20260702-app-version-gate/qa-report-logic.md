# QA 리포트 — 로직·통합 정합성 (app-version-gate)

> 검증자: qa-logic. 기준: `plan.md`(계약·인수조건) · `dev-notes.md` · `docs/testing-strategy.md` · `docs/code-convention.md`.
> 방법: 생산자↔소비자 양쪽 동시 읽기(마이그레이션↔fetch↔판정↔훅↔래퍼↔App.tsx) + 인크리멘털 2패스(슬라이스 A→B) + 종료 기준 직접 실행. 비주얼 충실도는 qa-visual(작업 #15 통과) 담당이라 다루지 않음.
> **판정: 통과(PASS) — 블로커 0(1차 발견 블로커 해소 확인). 경미(비차단) 관찰 4건 + 이월 4건.**

## 0. 종료 기준 직접 실행 결과

| 게이트 | 결과 |
|--------|------|
| `npx tsc --noEmit` | **exit 0**(클린) |
| `npx jest`(전체) | **166 suites / 1565 tests green** |
| appVersion 슬라이스 전체 | 11 suites / 60 tests green |

## 1. 1차 블로커 해소 확인 — PASS
- 1차 인크리멘털 패스에서 **App.tsx가 AppVersionGate를 마운트하지 않아 게이트 전체가 dead code**임을 발견해 developer에 수정 요청함(App.tsx:80 `<AuthGate/>` 그대로 렌더).
- **해소 확인**: `App.tsx:82-84`가 `<AppVersionGate><AuthGate/></AppVersionGate>`로 래핑. 배치는 `ThemeProvider`·`ToastProvider`·`AuthProvider` 안쪽(App.tsx:76-84) → ForceUpdateScreen/모달이 theme 토큰 사용 가능(§4.1 요건 충족). AppVersionGate가 AuthGate를 감싸 **force 시 로그인/스플래시 화면까지 대체**(로그인 전 강제 차단, §4.1 핵심) — 정합.

## 2. 슬라이스 A(로직·인프라) — PASS
### compareVersion / resolveVersionGate
- `compareVersion`: `/^\d+\.\d+\.\d+$/` 통과 시 정수 3튜플 per-part 비교, 아니면 null. **1.10.0 > 1.9.0 수치 비교**(문자열 아님) 실증. 형불량("1.0"·"a.b.c"·""·"1.0.0.0"·"v1.0.0"·공백)·음수 전부 null.
- `resolveVersionGate`: current null→unknown / min null→unknown / min 형불량→unknown / current<min→force / min<=current<latest & latest 유효→suggest / current>=latest→ok / latest null→unknown. 어느 비교라도 null이면 unknown(fail-open). 경계(==min→suggest, ==latest→ok) 실증.

### 시드↔판정 교차확인 (요청 항목) — PASS
- dormant 시드 min=`0.0.0`/latest=`1.0.0` + 현재 `1.0.0` → `vsMin=compare(1.0.0,0.0.0)=1`, `vsLatest=compare(1.0.0,1.0.0)=0` → **ok**(force·suggest 모두 미발화). 1.0.0 이상 어떤 current도 seed에선 force/suggest 안 남. **게이트 dormant 확정** — 운영자가 값 올릴 때만 활성.

### fetchAppConfig — PASS
- `.from('app_config').select('min_supported_version, latest_version, store_url_ios, store_url_android').eq('id',1).maybeSingle()` → snake→camel. **error/빈(0행)/비객체/예외 → null(throw 0)**. select 컬럼 4개·`.eq('id',1)`이 마이그레이션 컬럼·싱글턴과 정확히 정합.

### currentAppVersion — PASS
- `Constants.expoConfig?.version ?? null`. expoConfig 결측·version 결측 → null(fail-open). top-level import(expo-constants JS-only, 재빌드 불필요).

### updateSuggestDismissal — PASS
- save→load 왕복(latest 문자열 키잉), 미저장·빈문자열·예외 → null(throw 0). best-effort 쓰기.

### 마이그레이션 `20260702120000_app_config.sql` (RLS) — PASS
- 싱글턴 `check (id = 1)`, `enable row level security`, `create policy ... for select to anon, authenticated using (true)`(로그인 전 판정), **insert/update/delete 정책 부재**(grep `for insert|update|delete` 0 → RLS 기본 거부로 anon·authenticated 쓰기 불가, 운영자 service role만). 노출 데이터 = min/latest/store URL(**비민감**, 사용자 데이터 무관). dormant 시드 + `on conflict do nothing`. 기존 마이그레이션 미접촉(git status 신규 파일 1개).

## 3. 슬라이스 B(배선) — PASS
### useAppVersionGate (콜드스타트 1회 판정)
- 마운트 1회 `fetchAppConfig`→`getCurrentAppVersion`→`resolveVersionGate`. **fail-open 전 경로**: fetch null→none / current null(→unknown)→none / ok→none / unknown→none. **force는 dismissal 무시**(force 분기가 loadDismissedVersion 조회 없이 즉시 차단, useAppVersionGate.ts:53-56). **suggest 버전당 1회**: `loadDismissedVersion()===config.latestVersion`이면 none, 아니면 suggest + `suggestLatestRef` 기록(:58-68). `storeUrl = Platform.OS==='ios'?ios:android`(:51). `dismissSuggest`→`saveDismissedVersion({version: suggestLatestRef})`+none(:84-88). **폴링 0**(effect [] deps, fetchMock 1회 단언). async 경로 `mountedRef` 가드. 9 테스트 유의미 green.

### AppVersionGate (렌더 4분기 + 배선)
- **렌더 분기**: checking→자식 / none→자식(fail-open) / force→ForceUpdateScreen(자식 대체) / suggest→자식+UpdateSuggestModal. 실증(T7).
- **프롭 계약 정합**(생산자↔소비자): AppVersionGate→ForceUpdateScreen `{storeUrl, onUpdatePress}` = 컴포넌트 `ForceUpdateScreenProps` 일치. →UpdateSuggestModal `{visible, storeUrl, onUpdatePress, onDismiss}` = `UpdateSuggestModalProps` 일치.
- **Linking null-guard**: `openStore`가 storeUrl null이면 no-op(:22-25). storeUrl null → 버튼 부재 + 안내문 + `openURL` 0회 실증. storeUrl 있으면 버튼 탭→`Linking.openURL(storeUrl)`.
- **Android 하드웨어백 no-op(force 시)**: `BackHandler.addEventListener('hardwareBackPress', ()=>true)`를 force일 때만 등록, cleanup에서 remove(:28-38). 실제 발화는 디바이스 스모크(이월).
- `dismissSuggest` 콜백 배선(모달 "나중에"→dismiss, "업데이트"→Linking) 실증.

### ProfileScreen 버전 행 (T10)
- `getCurrentAppVersion()`→`appVersion`(ProfileScreen.tsx:219), `{appVersion ? <AppVersionRow version={appVersion}/> : null}`(:370) — **null→미렌더 guard** 존재. "앱 버전 1.2.3" 렌더 실증(spec:410-413).

## 4. 비용 가드레일 — PASS
- **1회 조회 / 폴링·Realtime·타이머 0**: useAppVersionGate effect [] deps 1 fetch(테스트 강제), 그 외 모듈에 setInterval/subscribe 0. 재판정=앱 재시작.
- **anon 읽기 1행·쓰기 거부**: RLS select만, 쓰기 정책 부재.
- **신규 네이티브 0**: expo-constants(~17.0.8, JS-only)·expo-linking(기존)만. expo-application 미도입. AWS 0, Edge Function 0, Kakao 0.

## 5. 컨벤션·TDD — PASS
- 화살표 const·named-object 인자(`{a,b}`·`{current,minSupported,latest}`·`{version}`·`{storeUrl}`)·enum-style(`VersionGateDecision`)·useEffect 명명 함수(`evaluateGateOnMount`·`blockHardwareBackOnForce`)·`useCallback`/`useMemo` 실호출 0. throw 0(전 경로).
- 테스트 유의미(load-bearing): compareVersion 수치비교·resolveVersionGate/훅 fail-open이 결함 시 red, AppVersionGate 렌더분기·Linking null-guard가 배선 결함 시 red.

## 6. 경미 관찰 (비차단)
1. ~~**App.tsx 배선 회귀 테스트 부재**~~ **[해소됨]** — 권장한 배선 가드 테스트를 developer가 추가함. 신규 `App.spec.tsx`가 무거운 leaf(폰트·스플래시·프로바이더·게이트·AuthGate)를 스텁하고 `within(gate).getByTestId('auth-gate')`로 **AppVersionGate가 AuthGate를 감싸 트리에 마운트되는지** 검증 — 래핑 제거 시 red. 유의미한 회귀 가드로 확인(App.spec 1 suite green). T7 배선 사각지대 닫힘.
2. **ProfileScreen null→미렌더 분기 미검증(화면 레벨)** — 코드 guard(`appVersion ? ... : null`)는 명확하고 `getCurrentAppVersion` null은 모듈 레벨에서 검증됨. 화면 레벨 null 케이스 테스트는 없음(무해).
3. **resolveVersionGate latest null → unknown(ok 아님)** — 다운스트림 동일(둘 다 none/fail-open)이고 plan+테스트와 일치하는 의도된 동작. 라벨 착오 우려만 기록.
4. **currentAppVersion 파일명/심볼 접두 불일치** — 파일 `currentAppVersion` vs export `getCurrentAppVersion`(get- 접두). 폴더=개념 일치라 사소, 관례상 트리비얼.

## 7. 미검증(외부·네이티브 — 라이브/디바이스 스모크 이월)
- **`app_config` RLS 실동작**(anon 읽기 허용·쓰기 거부) — `supabase db push` 후 라이브 스모크(RLS·권한은 라이브에서만 드러남, 메모리 `definer-storage-and-best-effort` 정신).
- **스토어 Linking 실동작**(`Linking.openURL` 실제 앱 이동) — 디바이스 스모크.
- **Android 하드웨어백 차단 실동작**(force 시 뒤로가기 no-op) — 디바이스 스모크.
- **expo-constants 실 버전값**(`Constants.expoConfig.version` 빌드별) — 디바이스 스모크(fail-open이 미확보 커버).
> 전부 "통과" 아닌 "이월"로 분류. plan §9 라이브 검증 항목과 일치.

## 결론
버전 비교 엣지(semver·결측·형불량)·조회 실패 fail-open 전 경로·RLS 설계·강제/권유 분기·버전당 1회 dismiss·비용 가드레일·컨벤션·TDD·**1차 블로커(App.tsx 미배선) 해소** 전 항목 **통과**. 종료 게이트(tsc 0 · jest 1565 green) 직접 실행 확인. 블로커 없음 — 스프린트 "로직 완료" 처리 가능. 경미 관찰 중 #1(App.tsx 배선 회귀 테스트)은 developer가 `App.spec.tsx` 추가로 **해소**, 나머지 3건은 비차단 트리비얼, 미검증 4건은 라이브/디바이스 스모크로 적절히 이월.
