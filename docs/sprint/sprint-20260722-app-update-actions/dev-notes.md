# Dev Notes — app-update-actions

> 구현: developer. 검증: `npm test` 전체 통과(183 suites / 1721 tests) + `npx tsc --noEmit` 0 에러.
> 범위: iOS 스토어 URL DB 반영(마이그레이션) + 설정 화면 업데이트 액션 배선. 게이트 인프라(UpdateSuggestModal·AppVersionGate·useAppVersionGate) 코드 무변경(결함 1은 순수 DB 값 문제).
> UI(AppVersionRow 비주얼·문구·톤 = T3)는 **ui-publisher 소유** — developer는 렌더 분기 데이터 계약과 배선만 담당.

---

## 1. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

### 결함 1 (권유 모달 스토어 이동) — end-to-end
| 생산자 | 계약 shape | 소비자 |
|--------|-----------|--------|
| `20260722120000_app_config_store_url_ios.sql`(UPSERT do-update) | `app_config.store_url_ios = 'https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594'` | `fetchAppConfig()` → `storeUrlIos` |
| `fetchAppConfig()` | `{ storeUrlIos, storeUrlAndroid, minSupportedVersion, latestVersion }` (기존, 무변경) | `useAppVersionGate`(기존)·`useAppUpdateStatus`(신규) |
| `useAppVersionGate` → suggest+storeUrl | `UpdateSuggestModal.storeUrl` | 2버튼 렌더 + `AppVersionGate.openStore`(Linking) |

→ URL이 채워지면 `UpdateSuggestModal.tsx:119-133`이 단일 "확인" 대신 2버튼(나중에│업데이트)을 렌더하고 "업데이트"→`Linking.openURL` 동작. **코드 변경 0, DB 값만으로 해소.**

### 결함 2 (설정 화면 업데이트 액션) — 신규 배선
| 생산자 | 계약 shape | 소비자 |
|--------|-----------|--------|
| `useAppUpdateStatus()` (신규 훅, T2) | `{ status: AppUpdateStatus }` — `checking` \| `available{storeUrl:string\|null}` \| `latest` \| `unknown` | `ProfileScreen`(T4) |
| `ProfileScreen`(T4) | `AppVersionRow` props: `version` / `status` / `onUpdatePress` | `AppVersionRow`(T3, ui-publisher) |
| `ProfileScreen.openStore` | `Linking.openURL(storeUrl)`, `storeUrl` null이면 no-op | expo-linking → iOS App Store |

**`AppUpdateStatus` 타입 단일 출처 = `useAppUpdateStatus.ts`(producer, data 계약).** AppVersionRow(UI)는 `import type { AppUpdateStatus }`로 소비만 — 의존 방향 UI→data 정상. (초기에 AppVersionRow에 중복 정의가 있었으나 ui-publisher와 조율해 훅으로 단일화, index.ts 중복 export 제거.)

### `useAppUpdateStatus` 매핑 (VersionGateDecision → AppUpdateStatus)
| resolveVersionGate | AppUpdateStatus | 근거 |
|--------------------|-----------------|------|
| `Force` | `available` + 플랫폼 storeUrl | 설정에선 force/suggest 모두 "업데이트 가능"(게이트 차단은 별개 경로) |
| `Suggest` | `available` + 플랫폼 storeUrl | |
| `Ok` | `latest` | |
| `Unknown` | `unknown` | fail-open(버전만) |
| `fetchAppConfig()` null | `unknown` | fail-open |

- **dismissal 미참조:** `useAppUpdateStatus`는 `updateSuggestDismissal`을 import하지 않는다 → 사용자가 권유 모달을 "나중에"로 닫아도 설정 행은 항상 업데이트 액션 노출(리더 요구). `useAppVersionGate`의 dismissal과 독립.
- **storeUrl 플랫폼 분기:** `Platform.OS === 'ios' ? config.storeUrlIos : config.storeUrlAndroid`.
- **폴링 0:** effect deps `[]`, 명명 함수 `evaluateUpdateStatusOnMount`, `fetchAppConfig` 마운트 1회. 언마운트 가드 `mountedRef`(useAppVersionGate 패턴 동일).

---

## 2. 구현/변경 파일

### 신규
- `supabase/migrations/20260722120000_app_config_store_url_ios.sql` — id=1 UPSERT do-update로 `store_url_ios` 실값 + `updated_at` 갱신. android·min·latest **미변경**(게이트 dormant 유지). 선행 `20260702120000_app_config.sql` **수정 안 함**.
- `src/features/appVersion/useAppUpdateStatus/useAppUpdateStatus.ts` — 설정용 판정 훅(+ `AppUpdateStatus` 타입 단일 출처).
- `src/features/appVersion/useAppUpdateStatus/{index.ts,useAppUpdateStatus.spec.ts}` — 배럴 + 단위 스펙(9 케이스).
- `src/features/appVersion/appConfigStoreUrlMigration/appConfigStoreUrlMigration.spec.ts` — 마이그레이션 SQL 계약 스모크(6 케이스). `--` 주석 제거 후 grep(실행 statement 기준으로 android/min/latest 미변경 단언).

### 수정
- `src/features/appVersion/index.ts` — `useAppUpdateStatus`·`AppUpdateStatus` export 추가(병합). (ui-publisher가 AppVersionRow export의 중복 `AppUpdateStatus` 제거.)
- `src/navigation/screens/ProfileScreen/ProfileScreen.tsx` — `useAppUpdateStatus` 소비, `openStore`(expo-linking, null no-op)·`handleUpdatePress`, `AppVersionRow`에 version/status/onUpdatePress 주입.
- `src/navigation/screens/ProfileScreen/ProfileScreen.spec.tsx` — `useAppUpdateStatus`·`expo-linking`·`currentAppVersion` 모킹 + T4 케이스 5건(available 탭→openURL / storeUrl null no-op / latest 라벨 / checking 버전만 / appVersion null 행 미렌더).

### ui-publisher 소유(참고, developer 미변경)
- `src/features/appVersion/AppVersionRow/AppVersionRow.tsx`·`AppVersionRow.spec.tsx` — 상태별 렌더(비주얼·문구·accentStrong·언더라인 톤). developer는 데이터 계약(`AppUpdateStatus` 타입·props 이름)만 협의.

---

## 3. 엣지케이스 처리
- **config 조회 실패** → `unknown` → 버전만(fail-open, 앱 정상).
- **storeUrl null(Android 미출시)** → available이어도 액션 미노출(AppVersionRow `status.storeUrl` 가드) + `openStore` null no-op **이중 방어**.
- **현재 버전 미확보** → `appVersion` null → 행 자체 미렌더(기존 가드 유지).
- **suggest dismiss 무관** → 설정 행 항상 업데이트 액션(dismissal 미참조).

---

## 4. 비용 가드레일
- AWS 0 · Edge Function 0 · 폴링/Realtime 0. ProfileScreen 마운트 1회 `app_config` 1행 select만.
- 신규 네이티브 모듈 0(`expo-constants`·`expo-linking` 기존) → 재빌드 불필요.

---

## 5. 라이브 적용 절차 (사용자/운영자 전담 — git·배포는 developer 미수행)
1. **마이그레이션 배포:** `supabase db push`로 `20260722120000_app_config_store_url_ios.sql` 적용(행은 dormant 시드로 존재 → do-update로 `store_url_ios`만 갱신).
   - 대안: Supabase SQL 에디터에서 동일 UPSERT 직접 실행.
2. **검증:** iOS 빌드에서 (a) 설정 행 = "최신 버전이에요"(현재 1.2.0 ≥ latest 1.0.0), (b) 권유 모달 2버튼·스토어 이동은 운영자가 `latest_version`을 임시 상향(예 1.3.0)하거나 낮은 current 빌드로 디바이스 스모크.
3. **다음 릴리스 배포 순서:** 새 빌드 심사 통과 → `latest_version` 상향(권유·설정 액션 활성, 비차단) → 충분한 유예 후에만 `min_supported_version` 상향(강제 차단).

---

## 6. 미완/후속
- **architecture.md 변경 이력 추가**(§5 백로그 app-version-gate 행에 app-update-actions 링크 부기) — 문서 정합, 별도 진행 가능.
- **디바이스 스모크**(iOS 스토어 실제 이동·권유 모달 2버튼) — 라이브(마이그레이션 적용 후) 필요. 단위 불가 항목.
