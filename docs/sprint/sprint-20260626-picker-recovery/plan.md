# Sprint: 이미지 picker 결과 복구 (sprint-20260626-picker-recovery)

## 문제 (실기기 확정 진단)
Android에서 `ImagePicker.launchImageLibraryAsync`가 **갤러리에서 사진 선택 후 promise를 resolve/reject하지 않고 hang**한다. 아바타·먹로그 사진 둘 다 실패. 권한 granted, 갤러리 열림, 진단 Alert로 "권한 OK(진단1) → 피커 결과(진단2) 안 뜸" 확인 = 결과 콜백 유실.
- 원인: Android가 갤러리(무거운 시스템 액티비티)로 전환하는 동안 **메모리 압박으로 MainActivity(앱) 파괴** → expo-image-picker가 onActivityResult를 잃음(Expo 공식 문서가 명시한 케이스). "활동 유지 안 함" OFF여도 메모리로 발생.
- 시도·기각: New Architecture OFF(무효 — 원인 아님), 미디어 권한 추가(유지, 무해).

## 해결 — getPendingResultAsync 복구 (Expo 공식)
`ImagePicker.getPendingResultAsync()`: Android에서 MainActivity 재생성 후, 유실된 picker 결과를 반환(다른 플랫폼·정상 케이스는 null). 앱 복귀/재마운트 시 호출해 유실 결과를 복구·재개한다.

### 설계
1. **picker 컨텍스트를 영속**(파괴되면 메모리는 날아가므로 AsyncStorage):
   - picker 호출 **직전** `AsyncStorage.setItem(PENDING_PICK_KEY, JSON.stringify(context))` — `context = { kind: 'avatar', userId }` 또는 `{ kind: 'muklog', roomId }`(먹로그는 후속, 이번은 아바타 우선).
   - 정상 resolve(파괴 안 됨) 시 키 제거.
2. **복구 진입점**: 앱 마운트 + AppState 'active' 복귀 시(App.tsx 또는 전용 훅) `getPendingResultAsync()` 호출.
   - 결과 있고(`!canceled && assets[0]`) + AsyncStorage 컨텍스트 있으면 → 그 kind로 라우팅:
     - `avatar` → 기존 업로드 플로우 재사용(processAvatarImage → upload → avatar_url update → ProfileProvider refresh). 성공 토스트.
   - 컨텍스트 키 제거(중복 처리 방지).
3. **정상 경로 보존**: 파괴 안 되면 기존 `await launchImageLibraryAsync`가 그대로 동작(회귀 0). 복구는 파괴 케이스만 추가로 잡는다.
4. **공용화**: 복구 로직을 `processAvatarImage→upload→update`와 공유(changeAvatar의 업로드 부분을 `uploadAvatarFromUri({ uri, userId })`로 추출 → 정상/복구 양쪽 재사용).

### 범위
- **이번 스프린트: 아바타 복구만** 구현·검증(사용자가 아바타로 테스트 중). 먹로그 사진 복구는 동일 패턴으로 **후속**(컨텍스트 kind 확장 지점만 열어둠).

## 인수조건 (= 테스트, TDD)
- **AC1** picker 직전 컨텍스트가 AsyncStorage에 저장되고, 정상 resolve 시 제거된다.
- **AC2** `getPendingResultAsync`가 유실 결과를 반환 + 저장된 avatar 컨텍스트가 있을 때 → 업로드 플로우(uploadAvatarFromUri) 실행 → avatar_url 갱신 + refresh + 성공 토스트. 컨텍스트 제거.
- **AC3** pending 결과 없음/null(정상·iOS) → 복구 no-op, 기존 동작 불변(회귀 0).
- **AC4** pending 있는데 컨텍스트 없음(또는 canceled) → 무시(잘못된 업로드 0).
- **AC5** 업로드 공용화(`uploadAvatarFromUri`)가 정상 changeAvatar·복구 양쪽에서 동일 동작(기존 useUpdateProfile.spec 회귀 0).
- **AC6** `npm test` green + `tsc --noEmit` 0.

## 리스크
- `getPendingResultAsync` 반환 타입(`ImagePickerResult | ImagePickerErrorResult | null`) 분기 정확히(에러 결과는 무시).
- 복구 호출 시점: App 마운트 1회 + AppState active. 중복 호출 방지(처리 중 플래그 or 컨텍스트 키 원자적 제거).
- **디바이스 검증 필수**: 단위테스트는 getPendingResultAsync를 모킹하므로 실제 파괴→복구는 실기기 스모크로만 확인(메모리 [[qa-layout-blind-spot]] 계열 — 런타임 동작).
- 이번에도 실패 시 백업: MainActivity `launchMode`(singleTask→singleTop) 조정 검토(단 OAuth 딥링크 영향 점검 필요) — 별도.
- 라이브 영향 없음(클라이언트 코드만). 추가 배포 불요.

## 작업
1. (dev) `uploadAvatarFromUri` 추출 + 컨텍스트 영속 + getPendingResultAsync 복구 훅 + App/Provider 배선 + 테스트(AC1~AC6).
2. (qa-logic) 복구 분기·타입·컨텍스트 라우팅·회귀 0·TDD. 디바이스 스모크는 사용자.
