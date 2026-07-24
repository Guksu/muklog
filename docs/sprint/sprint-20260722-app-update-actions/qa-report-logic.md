# QA Report — Logic / Integration (app-update-actions)

> 검증자: qa-logic. 방법: 생산자↔소비자 양쪽 동시 읽기(integration-qa 스킬). 비주얼 충실도는 qa-visual(PASS) 소관 — 미다룸.
> 결과: **전 항목 통과. 미해결 이슈 0.** `npm test` 183 suites / 1721 tests green, `npx tsc --noEmit` 0 에러(직접 실행 확인).

---

## 1. 통과 (PASS)

### T1 — iOS 스토어 URL 마이그레이션 (`20260722120000_app_config_store_url_ios.sql`)
- **UPSERT do-update가 `store_url_ios`+`updated_at`만 갱신** — `20260722120000_...sql:6-10`. `on conflict (id) do update`로 실무상 do-update 경로만 탐(선행 시드로 id=1 존재).
- **min/latest/android 미변경** — 실행 statement에 `store_url_android`·`min_supported_version`·`latest_version` 미포함(주석에만 언급). 게이트 dormant 유지 → 마이그레이션이 게이트를 활성화하지 않음(§0 계약 준수).
- **선행 마이그레이션 무수정** — `20260702120000_app_config.sql`은 신규 파일과 별개, 원본 그대로(메모리 `definer-storage-and-best-effort` 준수).
- **URL 정확** — `https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594` 문자열 정확. percent-encoding `%EB%A8%B9%EB%A1%9C%EA%B7%B8`(먹로그) 디코드 없이 유지.
- **컬럼 계약 대조** — `fetchAppConfig`가 `select('... store_url_ios ...')` → `storeUrlIos` 매핑(`fetchAppConfig.ts:32-42`)과 정합(snake→camel 일관).

### T2 — `useAppUpdateStatus` 훅
- **생산자 3종 재사용** — `fetchAppConfig`·`getCurrentAppVersion`·`resolveVersionGate` 그대로 호출(중복 로직 0), `useAppUpdateStatus.ts:31-46`.
- **dismissal 미참조** — `updateSuggestDismissal`(`loadDismissedVersion`/`saveDismissedVersion`) import 없음. `useAppVersionGate`(dismissal 참조, `useAppVersionGate.ts:13,60-66`)와 대비되는 계약 차이 확인 → 설정 액션은 "나중에"와 무관하게 항상 노출(리더 요구 충족).
- **매핑** — Force/Suggest→`available`+플랫폼 storeUrl, Ok→`latest`, Unknown/fetch null/current null/형불량→`unknown`(fail-open). 9 spec 케이스가 5매핑 + storeUrl 플랫폼 분기(ios/android) + available&storeUrl null + fetch 1회를 모두 단언.
- **폴링 0** — effect deps `[]`, 마운트 1회(`useAppUpdateStatus.ts:62-69`). 명명 함수 `evaluateUpdateStatusOnMount`+`cleanupUpdateStatus`. 언마운트 가드 `mountedRef`(useAppVersionGate 패턴 동일).

### T3↔T4 경계면 — AppVersionRow ↔ ProfileScreen
- **AppUpdateStatus 타입 단일 출처** — `useAppUpdateStatus.ts:15-19`가 유일 정의, AppVersionRow는 `import type`으로 소비만(`AppVersionRow.tsx:13`), index.ts는 useAppUpdateStatus에서만 export(`index.ts:25`, 중복 export 없음). 의존 방향 UI→data 정상.
- **status optional divergence(의도적)** — plan §3.3은 required, 구현은 `status?`/`onUpdatePress?` optional+기본 `{kind:'checking'}`(`AppVersionRow.tsx:22-33`). **ui-spec §89-90에 divergence로 명시 기록됨**(후방호환: 기존 T10 spec `<AppVersionRow version=.../>` 회귀 0). **ProfileScreen이 status를 실제 주입** — `ProfileScreen.tsx:373` `status={updateStatus}` 전달 확인 → 실사용 경로는 항상 status 주입, optional은 후방호환 안전판일 뿐.
- **렌더 분기(§3.3 표) 정합** — available+storeUrl→업데이트 액션(`accessibilityRole=button`, testID `app-version-update`), available+null→버전만, latest→최신 라벨, checking/unknown→버전만(`AppVersionRow.tsx:42-68`). 8 spec 케이스가 role/testID/press로 전 분기 커버.
- **ProfileScreen 배선** — `useAppUpdateStatus` 소비(`ProfileScreen.tsx:209`), `openStore` storeUrl null no-op(`212-215`), `handleUpdatePress`가 available일 때만 openStore(`218-220`) → **이중 방어**(Row가 null이면 액션 미렌더 + openStore null no-op). `appVersion` null이면 행 미렌더(`372-374`, 기존 가드 유지).

### 결함1 end-to-end (코드 무변경 논리 확인)
마이그레이션 `store_url_ios` → `fetchAppConfig().storeUrlIos` → `useAppVersionGate` suggest 시 `state.storeUrl`(ios) 반출(`useAppVersionGate.ts:51,67`) → `AppVersionGate`가 `UpdateSuggestModal.storeUrl`로 전달(`AppVersionGate.tsx:52-58`) → storeUrl truthy면 2버튼(나중에│업데이트) 렌더(`UpdateSuggestModal.tsx:93-118`) → "업데이트"→`onUpdatePress`→`openStore`→`Linking.openURL`(`AppVersionGate.tsx:22-25,55`). **DB 값만 채우면 코드 변경 0으로 2버튼·스토어 이동 성립.** 게이트 인프라 4파일 코드 무변경 확인.

### TDD / 회귀
- **`npm test`** — 183 suites / 1721 tests **전체 green**(dev-notes 주장과 일치).
- **`npx tsc --noEmit`** — **0 에러**(직접 실행).
- **신규 spec 의미성(load-bearing) 표본 검증** — 3개 핵심 단언을 mutation으로 깨뜨려 red 확인 후 복원:
  - 훅 Ok→latest를 unknown으로 변조 → `ok→latest` spec red.
  - 마이그레이션에 `store_url_android` 추가 → `android 미변경` spec red.
  - ProfileScreen `openStore`의 `Linking.openURL` 제거 → `available 탭→openURL` spec red.
  - 세 mutation 모두 정확히 대응 spec만 red → 껍데기 아님. 복원 후 54 tests green + 파일 byte-exact 확인.
- **회귀 0** — 기존 `AppVersionRow.spec`(후방호환 케이스)·`ProfileScreen.spec`(T10 앱버전 행)·게이트 인프라 spec 전부 통과.

### 가드레일
- **폴링/Realtime 0** — 훅 effect deps `[]`, `fetchAppConfig` 마운트 1회(spec `폴링 0` 케이스가 `toHaveBeenCalledTimes(1)` 단언).
- **AWS 0 · Edge Function 0** — Supabase 단일행 select만.
- **신규 네이티브 0** — `expo-constants`·`expo-linking` 기존 사용(재빌드 불필요).
- **시크릿 미기록** — .env/키 미열람.
- **코드 컨벤션** — `useCallback`/`useMemo` 실제 호출 0(주석만), `export function` 0(화살표 const), inline `useEffect(()=>` 0(명명 함수), named-object 인자(`openStore({storeUrl})`·`resolveVersionGate({...})`), enum-style 상수(`VersionGateDecision`), 판별 유니온 status는 예외 정합.

---

## 2. 실패 (FAIL)
없음.

---

## 3. 미검증 (라이브/디바이스 스모크 — 단위 불가, plan §9 명시)
- 실 `app_config` UPDATE 반영 후 iOS 빌드에서 설정 행 "최신 버전이에요"(현재 1.2.0 ≥ latest 1.0.0) 표시 — 마이그레이션 배포(운영자) 후 디바이스 스모크.
- 권유 모달 2버튼 렌더 + 실제 App Store(먹로그 페이지) 이동 — 운영자가 `latest_version` 임시 상향 또는 낮은 current 빌드로 디바이스 스모크.
> 논리·계약 경로는 코드 레벨로 전부 검증됨. 위 2건은 실 DB/네이티브 링크 의존이라 단위 경계 밖(정상적 미검증).

---

**결론: 로직·통합 인수조건 전 항목 통과. 스프린트 "로직 완료" 조건 충족.**
