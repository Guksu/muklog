# dev-notes — app-version-gate (앱 버전 확인·업데이트 안내)

> 구현: developer. plan.md + ui-spec.md 계약 그대로, TDD(Red→Green). **슬라이스 A(인프라·판정) + 슬라이스 B(훅·게이트·배선) 완료.**
> 종료 기준: 전체 `npm test` **165 suites / 1564 tests green** + `tsc --noEmit` 클린 + 회귀 0.

## 1. 슬라이스 A — 구현한 파일 (전부 신규)

| 파일 | 성격 | 내용 |
|------|------|------|
| `supabase/migrations/20260702120000_app_config.sql` | **신규 마이그레이션** | `app_config` 싱글턴(id=1 check), min/latest/store URL, RLS enable + anon+authenticated **select만**(insert/update/delete 정책 부재=거부), dormant 시드(min 0.0.0·latest 1.0.0·URL null) |
| `src/features/appVersion/appConfigMigration/appConfigMigration.spec.ts` | 마이그레이션 스모크 | SQL grep 계약(싱글턴 check·RLS·anon select·쓰기정책 부재·시드) |
| `src/features/appVersion/compareVersion/` | 순수 유틸 | `compareVersion({a,b})` — "x.y.z" 3자리 수치 비교, 형불량/결측→null. 빌드번호 제외 |
| `src/features/appVersion/resolveVersionGate/` | 순수 유틸 | `resolveVersionGate({current,minSupported,latest})` → `VersionGateDecision`(force/suggest/ok/unknown). 어느 비교라도 null→unknown=fail-open |
| `src/features/appVersion/fetchAppConfig/` | supabase 래퍼 | `fetchAppConfig()` → 1행 select(id=1) snake→camel, error/빈/형불량/예외→null(throw 0). 폴링 0 |
| `src/features/appVersion/currentAppVersion/` | expo-constants 취득 | `getCurrentAppVersion()` → `Constants.expoConfig?.version ?? null`(JS-only, 미확보→null) |
| `src/features/appVersion/updateSuggestDismissal/` | AsyncStorage 영속 | `loadDismissedVersion`/`saveDismissedVersion` — 버전당 1회 dismiss(latest 문자열 키잉) |
| `package.json` | 의존성 선언 | `expo-constants: ~17.0.8` 추가(node_modules에 이미 resolve됨 — 재빌드 불필요 JS-only) |
| `src/features/appVersion/index.ts` | 배럴 병합 | ui-publisher UI 3종 export 유지 + 로직 모듈 export 추가(병합, 대체 아님) |

**무변경 보장**: 적용된 마이그레이션·기존 스펙·App.tsx·ProfileScreen·AuthGate 전부 미접촉(슬라이스 A는 신규 추가만). DB/RPC/Edge Function/Realtime/폴링 0.

## 2. 생산자 ↔ 소비자 매핑 (QA 교차검증 경로 — 슬라이스 A 부분)

```
public.app_config(id=1, anon+auth select RLS, 시드 dormant)
   │ min_supported_version / latest_version / store_url_ios / store_url_android (snake)
   ▼
fetchAppConfig(): select('min_supported_version, latest_version, store_url_ios, store_url_android').eq('id',1).maybeSingle()
   │ → AppConfig{minSupportedVersion, latestVersion, storeUrlIos, storeUrlAndroid} (camel) | null(error/빈/예외=fail-open)
   ▼
[슬라이스 B: useAppVersionGate가 소비]
   current = getCurrentAppVersion()  ── expo-constants(app.json version) | null
   resolveVersionGate({ current, minSupported: cfg.minSupportedVersion, latest: cfg.latestVersion })
      ├ compareVersion({a,b})  ── "x.y.z" 3자리 비교 | null(형불량)
      └ → force | suggest | ok | unknown(fail-open)
   loadDismissedVersion() === latest ? none : suggest   (버전당 1회 노출 정책)
```

**컬럼↔select 계약**: fetchAppConfig의 select 컬럼 4개 = app_config 4개 컬럼과 정합(qa-logic 교차검증 지점 §7). snake→camel 매핑 단일 출처 = fetchAppConfig.

## 3. 주요 결정 사항 (plan 준수, 추측 없이)

- **fail-open 일관**: fetchAppConfig(error/빈/예외→null)·compareVersion(형불량→null)·resolveVersionGate(어느 비교 null→unknown)·getCurrentAppVersion(미확보→null) 전 경로가 실패 시 "막지 않음"으로 수렴. 버전 체크 실패로 앱을 못 쓰는 일 없음(설계 원칙 §6).
- **compareVersion 엄격 파싱**: `/^\d+\.\d+\.\d+$/`만 통과 — 2/4자리·접두 v·공백·prerelease는 형불량(null). 빌드번호(iOS buildNumber/Android versionCode) 미사용(min/latest도 semver 운영).
- **resolveVersionGate 순서**: current null→unknown → vsMin(null→unknown, -1→force) → vsLatest(null→unknown, -1→suggest) → ok. latest null이면 unknown(=suggest 미발화 fail-open, §3.1 정합).
- **RLS**: anon+authenticated select만(로그인 전 게이트 판정 §4.1), insert/update/delete 정책 부재 → 운영자 service role만 변경(앱 읽기 전용). 시드 dormant(min 0.0.0=전원 미차단·latest 1.0.0=권유 미발화) — 강제 게이트 남용 방지.
- **expo-constants**: JS-only라 top-level import 허용(네이티브 모듈 아님 → lazy-require 불요, 메모리 `native-module-lazy-require` 대상 아님). node_modules에 이미 17.0.8 resolve돼 있어 package.json 선언만 추가(재빌드 불필요). expo-application 미도입(§2 OUT).
- **dismiss = 버전당 1회**: latest_version 문자열을 키잉해 저장. 저장값===현재 latest면 미노출, 더 새 latest면 재노출(슬라이스 B useAppVersionGate가 비교). 강제(force)는 dismissal 무시(슬라이스 B 책임).
- **비용 가드레일**: 콜드스타트 1회 select만(폴링/Realtime 0), anon 읽기 1행(무료 티어 극소), 쓰기 0, AWS 0, 신규 네이티브 0.

## 4. 슬라이스 B — 배선한 파일 (신규 훅·래퍼 + 기존 2파일 수정)

| 파일 | 성격 | 내용 |
|------|------|------|
| `src/features/appVersion/useAppVersionGate/` | **신규 훅(T6)** | 콜드스타트 1회 fetch+판정 → `VersionGateState`(checking/force/suggest/none). storeUrl=`Platform.OS` 분기, dismiss(버전당 1회), 폴링 0 |
| `src/features/appVersion/AppVersionGate/` | **신규 래퍼(T7·T11)** | checking/none→children, force→ForceUpdateScreen(대체), suggest→children+UpdateSuggestModal. `Linking.openURL`(expo-linking, storeUrl null→no-op) + **Android 하드웨어백 no-op**(BackHandler, force 시) |
| `App.tsx` | 수정(T7) | `<AuthGate/>`를 `<AppVersionGate>`로 래핑(AuthProvider 안·ThemeProvider/ToastProvider 안 → 토큰 사용, AuthGate 상위) |
| `src/navigation/screens/ProfileScreen/ProfileScreen.tsx` | 수정(T10) | 회원탈퇴 행 아래 `<AppVersionRow version={appVersion}/>` — `getCurrentAppVersion()` null이면 미렌더. 딥임포트(supabase 미유입) |

- **딥임포트 결정**: ProfileScreen은 `@/features/appVersion/AppVersionRow`·`/currentAppVersion`에서 직접 임포트(배럴 아님) — 배럴은 fetchAppConfig→supabase를 끌어와 ProfileScreen(및 spec)에 불필요한 결합을 만든다. App.tsx는 게이트가 supabase를 쓰므로 배럴 임포트 유지.
- UI 3종(ForceUpdateScreen·UpdateSuggestModal·AppVersionRow)은 ui-publisher 소유 프리젠테이션 — developer는 props(storeUrl·onUpdatePress·onDismiss·visible·version)만 배선(비주얼 미접촉).

## 5. 배선 경계면 매핑 (슬라이스 B — QA 교차검증 완성)

```
App.tsx: <AppVersionGate><AuthGate/></AppVersionGate>  (AuthGate 상위 — 로그인 전에도 force 차단)
   ▼
AppVersionGate ── useAppVersionGate() ──▶ state
   ├ checking/none → {children}(AuthGate)                         ← 콜드스타트 비차단·fail-open
   ├ force   → <ForceUpdateScreen storeUrl onUpdatePress=openStore/>  (자식 대체) + BackHandler no-op
   └ suggest → {children} + <UpdateSuggestModal visible storeUrl onUpdatePress=openStore onDismiss=dismissSuggest/>
   openStore({storeUrl}) → storeUrl null? no-op : Linking.openURL(storeUrl)  (expo-linking, T11)

useAppVersionGate:
   fetchAppConfig() ──config|null──▶ (null→none)
   getCurrentAppVersion() ──current|null──▶ resolveVersionGate({current, min, latest})
      → force → {status:'force', storeUrl: Platform.OS==='ios'?iosUrl:androidUrl}
      → suggest → loadDismissedVersion()===latest ? none : {status:'suggest', latestVersion, storeUrl}
      → ok/unknown → none
   dismissSuggest() → saveDismissedVersion({version: latest}) + none

ProfileScreen: getCurrentAppVersion() ──ver|null──▶ ver ? <AppVersionRow version={ver}/> : null
```

## 6. 테스트 결과

- 슬라이스 A(로직): compareVersion 5·resolveVersionGate 8·fetchAppConfig 5·currentAppVersion 3·updateSuggestDismissal 5·appConfigMigration 8 = 34 green.
- 슬라이스 B(배선): useAppVersionGate 9(4분기·fail-open·플랫폼 storeUrl·dismiss·폴링0)·AppVersionGate 7(checking/none/force/suggest 렌더·Linking·null no-op)·ProfileScreen 버전 행 1 green.
- ui-publisher UI 3종(AppVersionRow·ForceUpdateScreen·UpdateSuggestModal) 스펙 green(배럴 병합).
- **App 배선 가드(T7)**: `App.spec.tsx` — AppVersionGate가 AuthGate를 감싸 트리에 마운트되는지 검증(leaf 스텁, 래핑 구조만). qa-logic 권고로 추가 — 배선 누락이 런타임에만 드러나던 사각지대 회귀 방지.
- 전체: **166 suites / 1565 tests green**, `tsc --noEmit` 클린. 회귀 0(App 프로바이더 트리·AuthGate·ProfileScreen 기존 동작 무변경, 버전 행 추가 외).

## 7. 라이브 검증(이월)

- `app_config` RLS(anon 읽기 허용·쓰기 거부)는 `supabase db push` 후 **라이브 스모크**(RLS는 라이브에서만 드러남).
- 실제 `Constants.expoConfig.version` 값·스토어 Linking·Android 하드웨어백 차단은 **디바이스 스모크**(슬라이스 B 이후).
- **운영 절차(architecture 이력 반영 필요)**: app_config 값 갱신은 SQL/대시보드, min_supported 상향 시 전 사용자 차단 주의(dormant 기본·형불량 fail-open이 안전판).
