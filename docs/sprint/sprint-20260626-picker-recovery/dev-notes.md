# Dev Notes — picker-recovery (아바타 복구만)

Android `launchImageLibraryAsync` 가 MainActivity 파괴로 promise hang(결과 유실)하는 문제를 Expo 공식 `getPendingResultAsync` 로 복구. **이번 범위는 아바타만**(먹로그 사진은 동일 패턴 후속, kind 필드만 열어둠).

## 변경/신설 파일
| 파일 | 종류 | 책임 |
|------|------|------|
| `src/features/profile/uploadAvatarFromUri.ts` | 신설 | changeAvatar 업로드 본체 추출(공용). process→fetch→upload→update→이전파일 정리 |
| `src/features/profile/uploadAvatarFromUri.spec.ts` | 신설 | AC5 — 정상/실패/이전파일 없음 |
| `src/features/profile/pendingPick.ts` | 신설 | picker 컨텍스트 AsyncStorage 영속(save/load/clear) + `PendingPickKind` enum-style + `PENDING_PICK_KEY` |
| `src/features/profile/pendingPick.spec.ts` | 신설 | AC1 — save/load/clear + 잘못된 형 방어 |
| `src/features/profile/useRecoverPendingPick.ts` | 신설 | 마운트+AppState active 시 `getPendingResultAsync` 복구 훅 |
| `src/features/profile/useRecoverPendingPick.spec.tsx` | 신설 | AC2/AC3/AC4 — 복구·no-op·잘못된 업로드 방지 |
| `src/features/profile/useUpdateProfile.ts` | 수정 | 업로드 부분을 `uploadAvatarFromUri` 로 위임 + picker 직전 컨텍스트 영속/정상 resolve 시 제거 |
| `src/features/profile/useUpdateProfile.spec.ts` | 수정 | AsyncStorage 모킹 추가 + AC1(영속/제거) 케이스. 기존 changeAvatar/saveNickname 단언 불변 |
| `src/features/profile/ProfileProvider.tsx` | 수정 | `useRecoverPendingPick({ refresh })` 배선(복구 진입점) |
| `src/features/profile/ProfileProvider.spec.tsx` | 수정 | 복구 훅 격리 모킹(부수효과 제거) |
| `src/features/profile/index.ts` | 수정 | 신규 표면 export |

## 생산자 ↔ 소비자 매핑 (QA 교차검증용)
- **업로드 공용 함수**: `uploadAvatarFromUri({ uri, userId })` → `{ avatarUrl }`
  - 소비자1(정상): `useUpdateProfile.changeAvatar` — picker 성공 uri로 호출
  - 소비자2(복구): `useRecoverPendingPick` — getPendingResultAsync 회수 uri로 호출
  - 양쪽 동일 업로드 경로 → 회귀 0 근거(아래)
- **컨텍스트 영속**: `savePendingPick({ context })` (changeAvatar, picker 직전) → `loadPendingPick()` / `clearPendingPick()` (복구 훅)
  - 키 `PENDING_PICK_KEY = 'muklog:pending-pick'`, 형 `{ kind:'avatar', userId }`
- **복구 진입점**: `ProfileProvider` (인증 userId·공유 refresh 보유) → `useRecoverPendingPick({ refresh })`
  - 업로드 성공 → `refresh()`(전 화면 반영) + 전역 토스트 `PICK_RECOVERED_TOAST='프로필 사진을 변경했어요'`(tone positive, `useToastController`)

## 컨텍스트 라이프사이클 (AC1)
1. `changeAvatar`: 권한 OK → **picker 호출 직전** `savePendingPick` → `launchImageLibraryAsync` → (정상 resolve) `clearPendingPick`.
2. 파괴 케이스: clear 미실행 → 컨텍스트 잔존 → 다음 마운트/foreground에서 복구가 읽어 처리 후 clear.

## 복구 흐름 / getPendingResultAsync 타입 분기 (AC2~AC4)
- 진입: 앱 마운트 1회 + `AppState 'active'` 복귀. `recoveringRef`(처리 중 가드)로 중복 호출 차단.
- **설치된 expo-image-picker 시그니처는 배열**: `getPendingResultAsync(): Promise<(ImagePickerResult | ImagePickerErrorResult)[]>` (plan은 단일/null로 기재했으나 실제 API는 배열 — 배열로 처리).
  - `pickRecoveredUri`: 항목 중 `canceled === false && assets[0].uri` 인 첫 성공 결과의 uri 선택.
  - 에러결과(`{ code, message }`, `canceled` 없음)·canceled 항목은 무시(AC4).
- 분기:
  - 유효 uri + `loadPendingPick()` kind==='avatar' → `clearPendingPick` → `uploadAvatarFromUri` → `refresh` → 토스트 (AC2)
  - 결과 없음/null/iOS·정상 → no-op (AC3)
  - 컨텍스트만 남고 uri 없음/canceled/에러 → `clearPendingPick`만(다음 오작동 방지), 업로드 0 (AC4)
  - 컨텍스트 없음 + 유효 결과 → 업로드 0(잘못된 업로드 방지, AC4)
- 복구 전체는 best-effort try/catch — 실패해도 앱 동작 무영향(다음 진입 재시도).

## 회귀 0 근거 (AC5)
- 정상 picker 경로(파괴 안 됨)는 기존 `await launchImageLibraryAsync` 그대로. 업로드 로직은 동일 코드를 `uploadAvatarFromUri` 로 **이동만**(process·fetch·upload·getPublicUrl·update·remove·orphan 정리 인자/순서 동일).
- 기존 `useUpdateProfile.spec` 단언(process 인자·upload 경로/contentType·avatar_url·이전파일 remove·실패 시 새파일 정리·에러 토큰) **전부 불변 유지**. 추가는 컨텍스트 영속/제거 1케이스뿐.
- 전 슈트 1389 tests green(신규 포함), 기존 ProfileProvider/ProfileScreen 등 회귀 없음.

## 디바이스 검증 한계 (필수 명시)
- **실제 MainActivity 파괴→복구는 단위로 검증 불가**: 단위는 `getPendingResultAsync`·AsyncStorage·supabase를 모킹하므로 "결과 유실→재마운트 회수" 런타임 경로는 **디바이스 스모크로만 확인 가능**(메모리 qa-layout-blind-spot 계열 — 픽셀/네이티브 런타임).
- 스모크 절차(사용자): 개발자옵션 "활동 유지 안 함" ON → 프로필 아바타 변경 → 갤러리에서 사진 선택 → 앱 복귀 시 자동 업로드 + "프로필 사진을 변경했어요" 토스트 + 아바타 갱신 확인.

## 테스트 / tsc 결과
- `npm test`: **150 suites / 1389 tests passed** (신규 profile 16 suites 107 tests 포함).
- `npx tsc --noEmit`: **EXIT 0** (오류 0).

## 미완/후속
- 먹로그 사진 복구: `PendingPickKind` 에 `'muklog'` 추가 + 복구 라우팅 분기 + 업로드 함수 분리(동일 패턴). 이번 범위 외.
